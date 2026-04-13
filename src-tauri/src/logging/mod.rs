use std::path::Path;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_logging(logs_dir: &Path, level: &str) {
    // Create the logs directory if it doesn't exist
    std::fs::create_dir_all(logs_dir).ok();

    // File appender - rotates daily, keeps based on config
    let file_appender = RollingFileAppender::new(Rotation::DAILY, logs_dir, "nodeus.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Build subscriber with both stdout and file output
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(level));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .with_target(true)
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true),
        )
        .with(
            fmt::layer()
                .with_writer(non_blocking)
                .with_target(true)
                .with_ansi(false)
                .json(),
        )
        .init();
}

// Store the guard so it lives for the app lifetime
// The guard ensures buffered logs are flushed on shutdown
static LOG_GUARD: std::sync::OnceLock<tracing_appender::non_blocking::WorkerGuard> =
    std::sync::OnceLock::new();

pub fn init_app_logging(logs_dir: &Path, level: &str) {
    std::fs::create_dir_all(logs_dir).ok();

    let file_appender = RollingFileAppender::new(Rotation::DAILY, logs_dir, "nodeus.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(level));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .with_target(true)
                .with_thread_ids(true),
        )
        .with(
            fmt::layer()
                .with_writer(non_blocking)
                .with_target(true)
                .with_ansi(false),
        )
        .init();

    LOG_GUARD.set(guard).ok();
}
