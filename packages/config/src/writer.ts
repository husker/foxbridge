import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { configSchema, type FoxbridgeConfig } from "./schema.js";

/**
 * Writes a FoxbridgeConfig to a YAML file atomically.
 * Uses a temp file in the same directory to avoid cross-filesystem rename errors (EXDEV).
 * Validates the written file by reading it back and running Zod schema validation.
 */
export function writeConfig(config: FoxbridgeConfig, path: string): void {
  const yamlContent = yaml.dump(config, {
    sortKeys: false,
    lineWidth: 120,
    noRefs: true,
  });

  // Write to temp file in the same directory (avoids EXDEV on Docker volumes)
  const dir = dirname(path);
  const tmpPath = join(dir, `.config-${Date.now()}.tmp`);

  writeFileSync(tmpPath, yamlContent, { encoding: "utf-8", mode: 0o600, flag: "wx" });

  // Validate by reading back and parsing
  const readBack = readFileSync(tmpPath, "utf-8");
  const parsed = yaml.load(readBack);
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    // Clean up temp file on validation failure
    try {
      renameSync(tmpPath, `${tmpPath}.invalid`);
    } catch {}
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed after write:\n${issues}`);
  }

  // Atomic rename
  renameSync(tmpPath, path);
}
