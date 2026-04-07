export interface ExecutionResult {
  stdout: string;
  stderr: string;
  duration_ms: number;
  success: boolean;
}

export interface KernelStatus {
  running: boolean;
  uptime_seconds: number;
}

export interface KernelError {
  kind: 'not_found' | 'spawn_failed' | 'execution_error' | 'timeout' | 'crashed';
  message: string;
  platform_hint?: string;
}
