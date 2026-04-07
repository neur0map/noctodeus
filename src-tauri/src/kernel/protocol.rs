/// Build the sentinel-delimited payload for the bootstrap kernel.
///
/// Format sent to stdin:
///   __NOCT_EXEC__{block_id}\n
///   {code lines}\n
///   __NOCT_CODE_END__\n
///
/// No escaping needed — the bootstrap script reads until the code-end sentinel.
pub fn wrap_code(block_id: &str, code: &str) -> String {
    format!(
        "__NOCT_EXEC__{}\n{}\n__NOCT_CODE_END__\n",
        block_id, code,
    )
}

/// Parse output between sentinels for a given block_id.
pub fn parse_output(raw: &str, block_id: &str) -> Option<String> {
    let start_marker = format!("__NOCT_START_{}__", block_id);
    let end_marker = format!("__NOCT_END_{}__", block_id);
    let start_idx = raw.find(&start_marker)?;
    let end_idx = raw.find(&end_marker)?;
    let content_start = start_idx + start_marker.len();
    if content_start >= end_idx {
        return Some(String::new());
    }
    Some(raw[content_start..end_idx].trim().to_string())
}
