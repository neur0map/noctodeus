pub mod manifest;
pub mod state;

pub use manifest::{CoreManifest, create_manifest, ensure_noctodeus_dir, load_manifest};
pub use state::{ActiveCore, AppState, CoreInfo};
