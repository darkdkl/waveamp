import type { LogLevel } from "../../shared/types";

export function logEvent(level: LogLevel, scope: string, message: string): void {
  window.electronAPI?.log?.(level, scope, message);
}
