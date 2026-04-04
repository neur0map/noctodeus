use serde::Serialize;

use crate::db::queries::FileInfo;

#[derive(Debug, Clone, Serialize)]
pub struct FileCreatedPayload {
    pub path: String,
    pub metadata: FileInfo,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileModifiedPayload {
    pub path: String,
    pub metadata: FileInfo,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileDeletedPayload {
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileRenamedPayload {
    pub old_path: String,
    pub new_path: String,
    pub metadata: FileInfo,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoreReadyPayload {
    pub file_tree: Vec<FileInfo>,
}
