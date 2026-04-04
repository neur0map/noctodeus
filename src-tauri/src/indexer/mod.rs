pub mod fts;
pub mod incremental;
pub mod scanner;

pub use incremental::FileEvent;
pub use scanner::{extract_title, scan_directory, scan_single_file};
