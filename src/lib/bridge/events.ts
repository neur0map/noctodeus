import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CoreReadyEvent,
  FileCreatedEvent,
  FileModifiedEvent,
  FileDeletedEvent,
  FileRenamedEvent,
} from "../types/events";

// ---------------------------------------------------------------------------
// Core lifecycle events
// ---------------------------------------------------------------------------

export function onCoreReady(
  cb: (e: CoreReadyEvent) => void,
): Promise<UnlistenFn> {
  return listen("core:ready", (event) => cb(event.payload as CoreReadyEvent));
}

export function onCoreClosed(cb: () => void): Promise<UnlistenFn> {
  return listen("core:closed", () => cb());
}

export function onCoreLost(cb: () => void): Promise<UnlistenFn> {
  return listen("core:lost", () => cb());
}

// ---------------------------------------------------------------------------
// File events
// ---------------------------------------------------------------------------

export function onFileCreated(
  cb: (e: FileCreatedEvent) => void,
): Promise<UnlistenFn> {
  return listen("file:created", (event) =>
    cb(event.payload as FileCreatedEvent),
  );
}

export function onFileModified(
  cb: (e: FileModifiedEvent) => void,
): Promise<UnlistenFn> {
  return listen("file:modified", (event) =>
    cb(event.payload as FileModifiedEvent),
  );
}

export function onFileDeleted(
  cb: (e: FileDeletedEvent) => void,
): Promise<UnlistenFn> {
  return listen("file:deleted", (event) =>
    cb(event.payload as FileDeletedEvent),
  );
}

export function onFileRenamed(
  cb: (e: FileRenamedEvent) => void,
): Promise<UnlistenFn> {
  return listen("file:renamed", (event) =>
    cb(event.payload as FileRenamedEvent),
  );
}
