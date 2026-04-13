use crate::errors::{CmdResult, NoctoError};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlContent {
    pub title: String,
    pub content: String,
}

/// Fetch a web page URL and extract its plain-text content.
#[tauri::command]
pub async fn url_fetch(url: String) -> CmdResult<UrlContent> {
    let response = reqwest::get(&url).await.map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to fetch URL: {e}"),
    })?;

    if !response.status().is_success() {
        return Err(NoctoError::Unexpected {
            detail: format!("HTTP error {}", response.status()),
        });
    }

    let html = response.text().await.map_err(|e| NoctoError::Unexpected {
        detail: format!("Failed to read response body: {e}"),
    })?;

    let title = extract_title(&html);
    let content = html_to_text(&html);

    Ok(UrlContent { title, content })
}

/// Extract the content of the `<title>` element, if present.
fn extract_title(html: &str) -> String {
    let lower = html.to_lowercase();
    if let Some(start) = lower.find("<title") {
        // skip past the closing `>` of the opening tag
        if let Some(gt) = lower[start..].find('>') {
            let content_start = start + gt + 1;
            if let Some(end) = lower[content_start..].find("</title>") {
                let raw = &html[content_start..content_start + end];
                return decode_entities(raw.trim());
            }
        }
    }
    String::new()
}

/// Strip HTML tags and return plain text with reasonable whitespace.
fn html_to_text(html: &str) -> String {
    // Remove <script>...</script> blocks (case-insensitive)
    let without_scripts = remove_block_tag(html, "script");
    // Remove <style>...</style> blocks
    let without_styles = remove_block_tag(&without_scripts, "style");

    let mut output = String::with_capacity(without_styles.len());
    let mut in_tag = false;
    let mut tag_buf = String::new();

    // Block-level tags that should emit a newline
    const BLOCK_TAGS: &[&str] = &[
        "p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6",
        "li", "tr", "td", "th", "blockquote", "pre", "hr",
        "article", "section", "header", "footer", "nav", "main",
    ];

    let bytes = without_styles.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        let ch = bytes[i] as char;
        if ch == '<' {
            in_tag = true;
            tag_buf.clear();
            i += 1;
            continue;
        }
        if ch == '>' && in_tag {
            in_tag = false;
            // Check if this is a block-level tag → emit newline
            let tag_name = tag_buf
                .trim_start_matches('/')
                .split_whitespace()
                .next()
                .unwrap_or("")
                .to_lowercase();
            if BLOCK_TAGS.contains(&tag_name.as_str()) {
                output.push('\n');
            }
            tag_buf.clear();
            i += 1;
            continue;
        }
        if in_tag {
            tag_buf.push(ch);
            i += 1;
            continue;
        }
        output.push(ch);
        i += 1;
    }

    // Decode HTML entities
    let decoded = decode_entities(&output);

    // Collapse runs of whitespace / blank lines
    let mut result = String::with_capacity(decoded.len());
    let mut prev_blank = false;
    for line in decoded.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !prev_blank {
                result.push('\n');
            }
            prev_blank = true;
        } else {
            result.push_str(trimmed);
            result.push('\n');
            prev_blank = false;
        }
    }

    result.trim().to_string()
}

/// Remove all occurrences of `<tag>…</tag>` (case-insensitive, including
/// attributes on the opening tag).
fn remove_block_tag(html: &str, tag: &str) -> String {
    let lower = html.to_lowercase();
    let open_pat = format!("<{}", tag);
    let close_pat = format!("</{}>", tag);

    let mut result = String::with_capacity(html.len());
    let mut pos = 0;

    loop {
        match lower[pos..].find(&open_pat) {
            None => {
                result.push_str(&html[pos..]);
                break;
            }
            Some(rel_start) => {
                let abs_start = pos + rel_start;
                // Copy everything before this tag
                result.push_str(&html[pos..abs_start]);
                // Find the matching close tag
                match lower[abs_start..].find(&close_pat) {
                    None => break, // malformed – drop the rest
                    Some(rel_end) => {
                        let abs_end = abs_start + rel_end + close_pat.len();
                        pos = abs_end;
                    }
                }
            }
        }
    }

    result
}

/// Decode common HTML character entities.
fn decode_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
}
