use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};
use tracing::{debug, error, trace, warn};

use crate::errors::NoctoError;

/// The debounce window: events are batched until no new event arrives
/// within this duration.
const DEBOUNCE_TIMEOUT: Duration = Duration::from_millis(100);

/// Classified file system change after debouncing.
#[derive(Debug, Clone)]
pub enum FileChange {
    Created(PathBuf),
    Modified(PathBuf),
    Deleted(PathBuf),
    Renamed { from: PathBuf, to: PathBuf },
}

/// A file watcher that debounces rapid filesystem events and yields
/// classified batches of changes through a channel receiver.
pub struct DebouncedWatcher {
    _watcher: RecommendedWatcher,
    receiver: mpsc::Receiver<Vec<FileChange>>,
    /// Sends a signal to the background debounce thread to shut down.
    shutdown_tx: mpsc::Sender<()>,
}

/// Raw event types tracked during the debounce window, before collapsing.
#[derive(Debug, Clone)]
enum RawAction {
    Created,
    Modified,
    Deleted,
    /// A rename source: this path was renamed away.
    RenamedFrom,
    /// A rename target: this path was renamed to.
    RenamedTo,
}

impl DebouncedWatcher {
    /// Start watching `path` recursively. Returns a `DebouncedWatcher` whose
    /// `receiver()` yields `Vec<FileChange>` batches.
    ///
    /// Changes inside any `.noctodeus/` directory are ignored.
    pub fn start(path: &Path) -> Result<Self, NoctoError> {
        let (raw_tx, raw_rx) = mpsc::channel::<Event>();
        let (batch_tx, batch_rx) = mpsc::channel::<Vec<FileChange>>();
        let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();

        // Start the notify watcher, forwarding raw events into raw_tx.
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    if let Err(e) = raw_tx.send(event) {
                        trace!("watcher channel closed: {}", e);
                    }
                }
                Err(e) => {
                    error!("notify error: {}", e);
                }
            }
        })?;

        watcher.watch(path, RecursiveMode::Recursive)?;
        debug!(path = %path.display(), "file watcher started");

        // Background thread: collects raw events, debounces, classifies, sends batches.
        let debounce_root = path.to_path_buf();
        thread::Builder::new()
            .name("noctodeus-debounce".into())
            .spawn(move || {
                debounce_loop(raw_rx, batch_tx, shutdown_rx, &debounce_root);
            })
            .map_err(|e| NoctoError::WatcherFailed {
                detail: format!("failed to spawn debounce thread: {}", e),
            })?;

        Ok(Self {
            _watcher: watcher,
            receiver: batch_rx,
            shutdown_tx,
        })
    }

    /// Returns a reference to the receiver that yields debounced change batches.
    pub fn receiver(&self) -> &mpsc::Receiver<Vec<FileChange>> {
        &self.receiver
    }

    /// Stop the watcher and its background debounce thread.
    pub fn stop(&self) {
        // Signal the debounce thread to exit. Ignore error if already shut down.
        let _ = self.shutdown_tx.send(());
        debug!("file watcher stop requested");
    }
}

/// Returns true if the path is inside a `.noctodeus/` directory.
fn is_noctodeus_path(path: &Path) -> bool {
    path.components().any(|c| {
        matches!(c, std::path::Component::Normal(name) if name == ".noctodeus")
    })
}

/// The main debounce loop running on its own thread.
///
/// Collects raw notify events, waits for the debounce window to expire
/// (100ms after the last event), then classifies and sends a batch.
fn debounce_loop(
    raw_rx: mpsc::Receiver<Event>,
    batch_tx: mpsc::Sender<Vec<FileChange>>,
    shutdown_rx: mpsc::Receiver<()>,
    _root: &Path,
) {
    // Accumulates (path -> list of raw actions) during a debounce window.
    let mut pending: HashMap<PathBuf, Vec<RawAction>> = HashMap::new();
    let mut last_event_time: Option<Instant> = None;

    loop {
        // Check for shutdown signal (non-blocking).
        if shutdown_rx.try_recv().is_ok() {
            debug!("debounce thread shutting down");
            return;
        }

        // Try to receive a raw event with a short timeout so we can
        // check the debounce window and shutdown signal regularly.
        let timeout = if pending.is_empty() {
            // No pending events: block longer to avoid busy-waiting.
            Duration::from_millis(200)
        } else {
            // We have pending events: check frequently so we can flush
            // once the debounce window expires.
            Duration::from_millis(20)
        };

        match raw_rx.recv_timeout(timeout) {
            Ok(event) => {
                // Filter out .noctodeus/ paths.
                let paths: Vec<PathBuf> = event
                    .paths
                    .into_iter()
                    .filter(|p| !is_noctodeus_path(p))
                    .collect();

                if paths.is_empty() {
                    continue;
                }

                last_event_time = Some(Instant::now());

                match event.kind {
                    EventKind::Create(_) => {
                        for p in paths {
                            trace!(path = %p.display(), "raw: create");
                            pending.entry(p).or_default().push(RawAction::Created);
                        }
                    }
                    EventKind::Modify(notify::event::ModifyKind::Name(
                        notify::event::RenameMode::From,
                    )) => {
                        if let Some(p) = paths.into_iter().next() {
                            trace!(path = %p.display(), "raw: rename-from");
                            pending.entry(p).or_default().push(RawAction::RenamedFrom);
                        }
                    }
                    EventKind::Modify(notify::event::ModifyKind::Name(
                        notify::event::RenameMode::To,
                    )) => {
                        if let Some(p) = paths.into_iter().next() {
                            trace!(path = %p.display(), "raw: rename-to");
                            pending.entry(p).or_default().push(RawAction::RenamedTo);
                        }
                    }
                    EventKind::Modify(notify::event::ModifyKind::Name(
                        notify::event::RenameMode::Both,
                    )) => {
                        // Some platforms deliver both paths at once.
                        let mut iter = paths.into_iter();
                        if let (Some(from), Some(to)) = (iter.next(), iter.next()) {
                            trace!(from = %from.display(), to = %to.display(), "raw: rename-both");
                            pending.entry(from).or_default().push(RawAction::RenamedFrom);
                            pending.entry(to).or_default().push(RawAction::RenamedTo);
                        }
                    }
                    EventKind::Modify(_) => {
                        for p in paths {
                            trace!(path = %p.display(), "raw: modify");
                            pending.entry(p).or_default().push(RawAction::Modified);
                        }
                    }
                    EventKind::Remove(_) => {
                        for p in paths {
                            trace!(path = %p.display(), "raw: delete");
                            pending.entry(p).or_default().push(RawAction::Deleted);
                        }
                    }
                    _ => {
                        // Access, Other, etc. -- ignored.
                    }
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // No event received. Check if debounce window has expired.
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                // Watcher dropped, flush remaining and exit.
                if !pending.is_empty() {
                    let batch = classify_batch(&mut pending);
                    if !batch.is_empty() {
                        let _ = batch_tx.send(batch);
                    }
                }
                debug!("raw event channel disconnected, debounce thread exiting");
                return;
            }
        }

        // Flush if debounce window has expired.
        if let Some(last) = last_event_time {
            if last.elapsed() >= DEBOUNCE_TIMEOUT && !pending.is_empty() {
                let batch = classify_batch(&mut pending);
                if !batch.is_empty() {
                    debug!(count = batch.len(), "flushing debounced batch");
                    if batch_tx.send(batch).is_err() {
                        warn!("batch receiver dropped, debounce thread exiting");
                        return;
                    }
                }
                last_event_time = None;
            }
        }
    }
}

/// Classify accumulated raw actions into `FileChange` events, collapsing
/// redundant sequences:
///
/// - create + modify = Created
/// - modify + modify = Modified
/// - create + delete = (ignored, no net change)
/// - rename-from + rename-to on different paths = Renamed
/// - rename-from with no rename-to = Deleted
/// - rename-to with no rename-from = Created
fn classify_batch(pending: &mut HashMap<PathBuf, Vec<RawAction>>) -> Vec<FileChange> {
    let mut changes = Vec::new();

    // Separate rename-from and rename-to entries to pair them.
    let mut from_paths: Vec<PathBuf> = Vec::new();
    let mut to_paths: Vec<PathBuf> = Vec::new();

    // First pass: identify rename pairs.
    for (path, actions) in pending.iter() {
        let has_from = actions.iter().any(|a| matches!(a, RawAction::RenamedFrom));
        let has_to = actions.iter().any(|a| matches!(a, RawAction::RenamedTo));

        if has_from && !has_to {
            from_paths.push(path.clone());
        }
        if has_to && !has_from {
            to_paths.push(path.clone());
        }
        // If a single path has both from and to, it's a same-path rename
        // which is effectively a modify (or a no-op). We handle it in the
        // second pass as a modify.
    }

    // Pair rename-from with rename-to. notify delivers them in order,
    // so pairing by index is correct when there is exactly one rename
    // happening at a time.
    let paired_count = from_paths.len().min(to_paths.len());
    for i in 0..paired_count {
        changes.push(FileChange::Renamed {
            from: from_paths[i].clone(),
            to: to_paths[i].clone(),
        });
    }

    // Unpaired rename-from => treat as Deleted.
    for path in from_paths.iter().skip(paired_count) {
        changes.push(FileChange::Deleted(path.clone()));
    }
    // Unpaired rename-to => treat as Created.
    for path in to_paths.iter().skip(paired_count) {
        changes.push(FileChange::Created(path.clone()));
    }

    // Collect paths that were part of rename pairs so we skip them in
    // the second pass.
    let mut rename_handled: std::collections::HashSet<&PathBuf> = std::collections::HashSet::new();
    for p in from_paths.iter().take(paired_count) {
        rename_handled.insert(p);
    }
    for p in to_paths.iter().take(paired_count) {
        rename_handled.insert(p);
    }
    // Also add unpaired renames (already handled above).
    for p in from_paths.iter().skip(paired_count) {
        rename_handled.insert(p);
    }
    for p in to_paths.iter().skip(paired_count) {
        rename_handled.insert(p);
    }

    // Second pass: classify non-rename paths by collapsing their action lists.
    for (path, actions) in pending.drain() {
        if rename_handled.contains(&path) {
            continue;
        }

        let net = collapse_actions(&actions);
        match net {
            Some(NetAction::Created) => changes.push(FileChange::Created(path)),
            Some(NetAction::Modified) => changes.push(FileChange::Modified(path)),
            Some(NetAction::Deleted) => changes.push(FileChange::Deleted(path)),
            None => {
                // No net effect (e.g., create then delete).
            }
        }
    }

    changes
}

#[derive(Debug)]
enum NetAction {
    Created,
    Modified,
    Deleted,
}

/// Collapse a sequence of raw actions into a single net action.
fn collapse_actions(actions: &[RawAction]) -> Option<NetAction> {
    let mut created = false;
    let mut deleted = false;
    let mut modified = false;

    for action in actions {
        match action {
            RawAction::Created => {
                created = true;
                deleted = false;
            }
            RawAction::Deleted => {
                deleted = true;
            }
            RawAction::Modified => {
                modified = true;
            }
            // rename-from/to on same path (both flags): treat as modified.
            RawAction::RenamedFrom | RawAction::RenamedTo => {
                modified = true;
            }
        }
    }

    if created && deleted {
        // Created then deleted: no net change.
        None
    } else if deleted {
        Some(NetAction::Deleted)
    } else if created {
        // create + any number of modifies = Created.
        Some(NetAction::Created)
    } else if modified {
        Some(NetAction::Modified)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_noctodeus_path() {
        assert!(is_noctodeus_path(Path::new("/home/user/core/.noctodeus/meta.db")));
        assert!(is_noctodeus_path(Path::new("/home/user/core/.noctodeus/logs/core.log")));
        assert!(!is_noctodeus_path(Path::new("/home/user/core/notes/hello.md")));
        assert!(!is_noctodeus_path(Path::new("/home/user/core/noctodeus-notes.md")));
    }

    #[test]
    fn test_collapse_create_modify_is_create() {
        let actions = vec![RawAction::Created, RawAction::Modified, RawAction::Modified];
        let result = collapse_actions(&actions);
        assert!(matches!(result, Some(NetAction::Created)));
    }

    #[test]
    fn test_collapse_create_delete_is_none() {
        let actions = vec![RawAction::Created, RawAction::Modified, RawAction::Deleted];
        let result = collapse_actions(&actions);
        assert!(result.is_none());
    }

    #[test]
    fn test_collapse_modify_only() {
        let actions = vec![RawAction::Modified, RawAction::Modified];
        let result = collapse_actions(&actions);
        assert!(matches!(result, Some(NetAction::Modified)));
    }

    #[test]
    fn test_collapse_delete_only() {
        let actions = vec![RawAction::Deleted];
        let result = collapse_actions(&actions);
        assert!(matches!(result, Some(NetAction::Deleted)));
    }

    #[test]
    fn test_classify_batch_pairs_renames() {
        let mut pending = HashMap::new();
        pending.insert(
            PathBuf::from("/core/old.md"),
            vec![RawAction::RenamedFrom],
        );
        pending.insert(
            PathBuf::from("/core/new.md"),
            vec![RawAction::RenamedTo],
        );
        pending.insert(
            PathBuf::from("/core/changed.md"),
            vec![RawAction::Modified],
        );

        let batch = classify_batch(&mut pending);
        assert_eq!(batch.len(), 2);

        let has_rename = batch.iter().any(|c| matches!(c, FileChange::Renamed { .. }));
        let has_modify = batch.iter().any(|c| matches!(c, FileChange::Modified(_)));
        assert!(has_rename);
        assert!(has_modify);
    }
}
