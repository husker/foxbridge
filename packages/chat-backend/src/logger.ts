import type { FoxbridgeConfig } from "@foxbridge/config";
import { PiiScrubber } from "@foxbridge/scrubber";

type LogLevel = "debug" | "info" | "warn" | "error";
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export type Logger = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => void;

export function createLogger(config: FoxbridgeConfig): Logger {
  const minLevel = LEVELS[config.log_level];
  const scrubber = config.scrub_pii ? new PiiScrubber() : null;

  return function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
    if (LEVELS[level] < minLevel) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      msg: scrubber ? scrubber.scrubText(msg) : msg,
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  };
}
