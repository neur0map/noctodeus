/// Wrap user code with sentinel markers for output capture.
pub fn wrap_code(block_id: &str, code: &str) -> String {
    let escaped = code
        .replace('\\', "\\\\")
        .replace("\"\"\"", "\\\"\\\"\\\"");
    format!(
        "print(\"__NOCT_START_{bid}__\")\ntry:\n    exec(\"\"\"{code}\"\"\")\nexcept Exception as __noct_e:\n    import traceback; traceback.print_exc()\nprint(\"__NOCT_END_{bid}__\")\n",
        bid = block_id,
        code = escaped,
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
