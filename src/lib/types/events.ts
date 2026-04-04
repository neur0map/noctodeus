import type { FileNode } from "./core";

// ---------------------------------------------------------------------------
// Core lifecycle events
// ---------------------------------------------------------------------------

export interface CoreReadyEvent {
  file_tree: FileNode[];
}

export interface CoreClosedEvent {}

export interface CoreLostEvent {}

// ---------------------------------------------------------------------------
// File events
// ---------------------------------------------------------------------------

export interface FileCreatedEvent {
  path: string;
  metadata: FileNode;
}

export interface FileModifiedEvent {
  path: string;
  metadata: FileNode;
}

export interface FileDeletedEvent {
  path: string;
}

export interface FileRenamedEvent {
  old_path: string;
  new_path: string;
  metadata: FileNode;
}

/** Discriminated union covering every file-system event the backend can emit. */
export type FileEvent =
  | { type: "created"; payload: FileCreatedEvent }
  | { type: "modified"; payload: FileModifiedEvent }
  | { type: "deleted"; payload: FileDeletedEvent }
  | { type: "renamed"; payload: FileRenamedEvent };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Structured error returned from the Rust backend via Tauri commands. */
export interface NoctoError {
  code: string;
  message: string;
}
