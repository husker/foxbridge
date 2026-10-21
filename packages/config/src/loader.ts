import { readFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
import { configSchema, type FoxbridgeConfig } from "./schema.js";

const CONFIG_SEARCH_PATHS = [
  "/etc/foxbridge/config.yaml",
  "/var/lib/foxbridge/config.yaml",
];

/** The path where the setup wizard writes config on the Docker data volume. */
export const WIZARD_CONFIG_PATH = "/var/lib/foxbridge/config.yaml";

/**
 * Searches for a config file in order of precedence:
 * 1. FOXBRIDGE_CONFIG env var
 * 2. foxbridge.yaml in cwd
 * 3. /etc/foxbridge/config.yaml (Docker mount)
 * 4. /var/lib/foxbridge/config.yaml (wizard-written)
 */
export function findConfigPath(): string | null {
  const envPath = process.env["FOXBRIDGE_CONFIG"];
  if (envPath && existsSync(envPath)) return envPath;

  const cwdPath = "foxbridge.yaml";
  if (existsSync(cwdPath)) return cwdPath;

  for (const p of CONFIG_SEARCH_PATHS) {
    if (existsSync(p)) return p;
  }

  return null;
}

export function loadConfig(filePath: string): FoxbridgeConfig {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(`Failed to read config file: ${filePath}`, { cause: err });
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse YAML in config file: ${filePath}`, { cause: err });
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${issues}`);
  }

  return result.data;
}
