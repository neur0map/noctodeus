//! Nodeus MCP Server
//!
//! A standalone binary that exposes note operations as MCP tools over
//! JSON-RPC on stdin/stdout.  This lets external AI agents (Claude Desktop,
//! Cursor, etc.) read, search, create, and manage notes in a Nodeus core.
//!
//! Usage:
//!     nodeus-mcp /path/to/my-vault

use std::io::{self, BufRead, Write as _};
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use serde_json::{json, Value};

use nodeus_lib::db::migrations::run_all_migrations;
use nodeus_lib::db::mutations;
use nodeus_lib::db::queries;
use nodeus_lib::indexer::scanner;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 2 {
        eprintln!("Usage: nodeus-mcp <core-path>");
        std::process::exit(1);
    }

    let core_path = PathBuf::from(&args[1]);
    if !core_path.exists() {
        eprintln!("Error: core path does not exist: {}", core_path.display());
        std::process::exit(1);
    }

    // Ensure .nodeus directory exists.
    let nodeus_dir = core_path.join(".nodeus");
    if !nodeus_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&nodeus_dir) {
            eprintln!("Error: failed to create .nodeus dir: {e}");
            std::process::exit(1);
        }
    }

    // Open SQLite connection directly (single-threaded binary).
    let db_path = nodeus_dir.join("meta.db");
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error: failed to open database: {e}");
            std::process::exit(1);
        }
    };

    // Set pragmas.
    if let Err(e) = conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;",
    ) {
        eprintln!("Error: failed to set pragmas: {e}");
        std::process::exit(1);
    }

    // Run schema migrations.
    if let Err(e) = run_all_migrations(&conn) {
        eprintln!("Error: failed to run migrations: {e}");
        std::process::exit(1);
    }

    // Create memory table (outside migration system).
    if let Err(e) = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS memory (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );",
    ) {
        eprintln!("Error: failed to create memory table: {e}");
        std::process::exit(1);
    }

    eprintln!("nodeus-mcp: ready (core={})", core_path.display());

    // Enter the main loop.
    run_server(&conn, &core_path);
}

// ---------------------------------------------------------------------------
// Server loop
// ---------------------------------------------------------------------------

fn run_server(conn: &Connection, core_path: &Path) {
    let stdin = io::stdin();
    let reader = stdin.lock();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("nodeus-mcp: stdin read error: {e}");
                break;
            }
        };

        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }

        let msg: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": {
                        "code": -32700,
                        "message": format!("Parse error: {e}")
                    }
                });
                send_response(&resp);
                continue;
            }
        };

        let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
        let id = msg.get("id").cloned();
        let params = msg.get("params").cloned().unwrap_or(json!({}));

        match method {
            "initialize" => {
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        },
                        "serverInfo": {
                            "name": "nodeus-mcp",
                            "version": "0.1.0"
                        }
                    }
                });
                send_response(&resp);
            }

            "notifications/initialized" => {
                // Notification: no response required.
                eprintln!("nodeus-mcp: client initialized");
            }

            "tools/list" => {
                let tools = build_tool_definitions();
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "tools": tools
                    }
                });
                send_response(&resp);
            }

            "tools/call" => {
                let tool_name = params
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("");
                let arguments = params
                    .get("arguments")
                    .cloned()
                    .unwrap_or(json!({}));

                let result = dispatch_tool(conn, core_path, tool_name, &arguments);
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": result
                });
                send_response(&resp);
            }

            _ => {
                // Unknown method.
                if id.is_some() {
                    let resp = json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": {
                            "code": -32601,
                            "message": format!("Method not found: {method}")
                        }
                    });
                    send_response(&resp);
                }
                // If no id, it is a notification -- silently ignore.
            }
        }
    }
}

fn send_response(value: &Value) {
    let out = serde_json::to_string(value).expect("failed to serialize response");
    let stdout = io::stdout();
    let mut handle = stdout.lock();
    let _ = writeln!(handle, "{out}");
    let _ = handle.flush();
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

fn build_tool_definitions() -> Value {
    json!([
        {
            "name": "nodeus_search",
            "description": "Search across all notes in the vault using full-text search. Returns matching note paths, titles, and content snippets with relevance scores.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Full-text search query. Supports FTS5 syntax (AND, OR, NOT, phrase queries with double quotes)."
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "nodeus_read",
            "description": "Read the full content of a note by its relative path within the vault. Returns the raw file content (markdown, text, etc.).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the note within the vault (e.g. 'notes/meeting.md' or 'journal/2026-04-08.md')."
                    }
                },
                "required": ["path"]
            }
        },
        {
            "name": "nodeus_create",
            "description": "Create a new note at the given path with the provided content. Creates parent directories as needed. Fails if a note already exists at the path.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path for the new note (e.g. 'ideas/new-project.md')."
                    },
                    "content": {
                        "type": "string",
                        "description": "The full content to write to the note."
                    }
                },
                "required": ["path", "content"]
            }
        },
        {
            "name": "nodeus_update",
            "description": "Update (overwrite) the content of an existing note. Also updates the full-text search index.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the note to update."
                    },
                    "content": {
                        "type": "string",
                        "description": "The new content to write to the note (replaces existing content entirely)."
                    }
                },
                "required": ["path", "content"]
            }
        },
        {
            "name": "nodeus_delete",
            "description": "Delete a note by moving it to the system trash. Also removes it from the database and search index.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the note to delete."
                    }
                },
                "required": ["path"]
            }
        },
        {
            "name": "nodeus_list",
            "description": "List notes and folders. If a folder path is provided, lists its direct children. If omitted, lists all files in the vault.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "folder": {
                        "type": "string",
                        "description": "Optional folder path to list contents of. Use '.' for the vault root. Omit to list all files."
                    }
                },
                "required": []
            }
        },
        {
            "name": "nodeus_memory_set",
            "description": "Store a key-value pair in the AI memory table. Useful for persisting information across conversations (preferences, context, summaries). Overwrites any existing value for the key.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The memory key (e.g. 'user_preferences', 'project_context')."
                    },
                    "value": {
                        "type": "string",
                        "description": "The value to store."
                    }
                },
                "required": ["key", "value"]
            }
        },
        {
            "name": "nodeus_memory_get",
            "description": "Retrieve a value from the AI memory table by its key. Returns null if the key does not exist.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The memory key to look up."
                    }
                },
                "required": ["key"]
            }
        },
        {
            "name": "nodeus_memory_list",
            "description": "List all keys stored in the AI memory table. Useful for discovering what context has been persisted.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    ])
}

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

fn dispatch_tool(conn: &Connection, core_path: &Path, name: &str, args: &Value) -> Value {
    let result = match name {
        "nodeus_search" => tool_search(conn, args),
        "nodeus_read" => tool_read(core_path, args),
        "nodeus_create" => tool_create(conn, core_path, args),
        "nodeus_update" => tool_update(conn, core_path, args),
        "nodeus_delete" => tool_delete(conn, core_path, args),
        "nodeus_list" => tool_list(conn, args),
        "nodeus_memory_set" => tool_memory_set(conn, args),
        "nodeus_memory_get" => tool_memory_get(conn, args),
        "nodeus_memory_list" => tool_memory_list(conn),
        _ => Err(format!("Unknown tool: {name}")),
    };

    match result {
        Ok(text) => json!({
            "content": [{
                "type": "text",
                "text": text
            }],
            "isError": false
        }),
        Err(e) => json!({
            "content": [{
                "type": "text",
                "text": e
            }],
            "isError": true
        }),
    }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

fn tool_search(conn: &Connection, args: &Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: query")?;

    let hits = queries::search_fts(conn, query).map_err(|e| format!("Search failed: {e}"))?;

    let results: Vec<Value> = hits
        .iter()
        .map(|h| {
            json!({
                "path": h.path,
                "title": h.title,
                "snippet": h.snippet,
                "score": h.score
            })
        })
        .collect();

    serde_json::to_string_pretty(&results).map_err(|e| format!("Serialization error: {e}"))
}

fn tool_read(core_path: &Path, args: &Value) -> Result<String, String> {
    let rel_path = args
        .get("path")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: path")?;

    // Prevent path traversal.
    if rel_path.contains("..") {
        return Err("Path traversal not allowed".to_string());
    }

    let abs_path = core_path.join(rel_path);
    if !abs_path.exists() {
        return Err(format!("File not found: {rel_path}"));
    }

    std::fs::read_to_string(&abs_path).map_err(|e| format!("Failed to read file: {e}"))
}

fn tool_create(conn: &Connection, core_path: &Path, args: &Value) -> Result<String, String> {
    let rel_path = args
        .get("path")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: path")?;
    let content = args
        .get("content")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: content")?;

    if rel_path.contains("..") {
        return Err("Path traversal not allowed".to_string());
    }

    let abs_path = core_path.join(rel_path);
    if abs_path.exists() {
        return Err(format!("File already exists: {rel_path}"));
    }

    // Create parent directories.
    if let Some(parent) = abs_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    // Write the file.
    std::fs::write(&abs_path, content).map_err(|e| format!("Failed to write file: {e}"))?;

    // Build FileInfo and upsert into DB.
    let file_info = scanner::scan_single_file(core_path, &abs_path)
        .map_err(|e| format!("Failed to scan file: {e}"))?;
    mutations::upsert_file(conn, &file_info)
        .map_err(|e| format!("Failed to upsert file record: {e}"))?;

    // Update FTS index.
    let title = scanner::extract_title(content);
    mutations::upsert_fts(conn, rel_path, title.as_deref(), content)
        .map_err(|e| format!("Failed to update FTS index: {e}"))?;

    Ok(format!("Created: {rel_path}"))
}

fn tool_update(conn: &Connection, core_path: &Path, args: &Value) -> Result<String, String> {
    let rel_path = args
        .get("path")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: path")?;
    let content = args
        .get("content")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: content")?;

    if rel_path.contains("..") {
        return Err("Path traversal not allowed".to_string());
    }

    let abs_path = core_path.join(rel_path);
    if !abs_path.exists() {
        return Err(format!("File not found: {rel_path}"));
    }

    // Write the file.
    std::fs::write(&abs_path, content).map_err(|e| format!("Failed to write file: {e}"))?;

    // Re-scan and upsert into DB.
    let file_info = scanner::scan_single_file(core_path, &abs_path)
        .map_err(|e| format!("Failed to scan file: {e}"))?;
    mutations::upsert_file(conn, &file_info)
        .map_err(|e| format!("Failed to upsert file record: {e}"))?;

    // Update FTS index.
    let title = scanner::extract_title(content);
    mutations::upsert_fts(conn, rel_path, title.as_deref(), content)
        .map_err(|e| format!("Failed to update FTS index: {e}"))?;

    Ok(format!("Updated: {rel_path}"))
}

fn tool_delete(conn: &Connection, core_path: &Path, args: &Value) -> Result<String, String> {
    let rel_path = args
        .get("path")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: path")?;

    if rel_path.contains("..") {
        return Err("Path traversal not allowed".to_string());
    }

    let abs_path = core_path.join(rel_path);
    if !abs_path.exists() {
        return Err(format!("File not found: {rel_path}"));
    }

    // Move to system trash.
    trash::delete(&abs_path).map_err(|e| format!("Failed to trash file: {e}"))?;

    // Remove from DB.
    mutations::delete_file(conn, rel_path)
        .map_err(|e| format!("Failed to remove DB record: {e}"))?;

    // Remove from FTS.
    mutations::delete_fts(conn, rel_path)
        .map_err(|e| format!("Failed to remove FTS entry: {e}"))?;

    Ok(format!("Deleted (trashed): {rel_path}"))
}

fn tool_list(conn: &Connection, args: &Value) -> Result<String, String> {
    let folder = args.get("folder").and_then(Value::as_str);

    let files = match folder {
        Some(f) => {
            queries::list_files(conn, f).map_err(|e| format!("Failed to list files: {e}"))?
        }
        None => {
            queries::get_all_files(conn).map_err(|e| format!("Failed to list all files: {e}"))?
        }
    };

    let results: Vec<Value> = files
        .iter()
        .map(|f| {
            json!({
                "path": f.path,
                "name": f.name,
                "title": f.title,
                "isDirectory": f.is_directory,
                "size": f.size,
                "modifiedAt": f.modified_at
            })
        })
        .collect();

    serde_json::to_string_pretty(&results).map_err(|e| format!("Serialization error: {e}"))
}

fn tool_memory_set(conn: &Connection, args: &Value) -> Result<String, String> {
    let key = args
        .get("key")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: key")?;
    let value = args
        .get("value")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: value")?;

    conn.execute(
        "INSERT OR REPLACE INTO memory (key, value, updated_at) VALUES (?1, ?2, strftime('%s', 'now'))",
        params![key, value],
    )
    .map_err(|e| format!("Failed to set memory: {e}"))?;

    Ok(format!("Stored: {key}"))
}

fn tool_memory_get(conn: &Connection, args: &Value) -> Result<String, String> {
    let key = args
        .get("key")
        .and_then(Value::as_str)
        .ok_or("Missing required argument: key")?;

    let result: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT value FROM memory WHERE key = ?1",
        params![key],
        |row| row.get(0),
    );

    match result {
        Ok(value) => Ok(value),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok("null".to_string()),
        Err(e) => Err(format!("Failed to get memory: {e}")),
    }
}

fn tool_memory_list(conn: &Connection) -> Result<String, String> {
    let mut stmt = conn
        .prepare("SELECT key FROM memory ORDER BY key ASC")
        .map_err(|e| format!("Failed to list memory keys: {e}"))?;

    let keys: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query memory: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    serde_json::to_string_pretty(&keys).map_err(|e| format!("Serialization error: {e}"))
}
