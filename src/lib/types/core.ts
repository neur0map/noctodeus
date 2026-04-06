/** Metadata about an opened core (vault). */
export interface CoreInfo {
  id: string;
  name: string;
  path: string;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp of last access */
  last_opened?: string;
}

/** A single node in the file tree (file or directory). */
export interface FileNode {
  path: string;
  parent_dir: string;
  name: string;
  extension: string | null;
  /** Extracted from frontmatter or first heading */
  title: string | null;
  size: number;
  /** Unix timestamp (seconds) */
  modified_at: number;
  content_hash: string;
  is_directory: boolean;
  aliases?: string[];
}

/** File content paired with its metadata. */
export interface FileContent {
  path: string;
  content: string;
  metadata: FileNode;
}

/** A single search result with relevance scoring. */
export interface SearchHit {
  path: string;
  title: string | null;
  snippet: string;
  score: number;
}

/** A file tree node with children and expansion state (used by UI components). */
export interface TreeNode extends FileNode {
  children: TreeNode[];
  expanded: boolean;
}

/** Shape of .noctodeus/manifest.json inside a core. */
export interface CoreManifest {
  core: {
    name: string;
    id: string;
    created_at: string;
    version: number;
  };
  logging: {
    level: string;
    max_file_size: number;
    max_rotations: number;
  };
}
