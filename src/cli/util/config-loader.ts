import * as fs from "node:fs";
import * as path from "node:path";
import type { ProtoDBConfig } from "../../types.js";

const CONFIG_FILENAMES = [
  "protodb.config.json",
  "protodb.json",
];

export function findConfigFile(cwd: string = process.cwd()): string | null {
  for (const name of CONFIG_FILENAMES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function loadConfig(cwd: string = process.cwd()): ProtoDBConfig {
  const configPath = findConfigFile(cwd);

  if (!configPath) {
    // Return default config
    return {
      adapter: { adapter: "json", path: "./data" },
      migrationsDir: "./migrations",
    };
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as ProtoDBConfig;

  return {
    adapter: parsed.adapter ?? { adapter: "json", path: "./data" },
    migrationsDir: parsed.migrationsDir ?? "./migrations",
  };
}
