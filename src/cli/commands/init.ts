import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../util/logger.js";
import { findConfigFile } from "../util/config-loader.js";
import { AdapterType } from "../../types.js";

const DEFAULT_CONFIG = {
  adapter: {
    adapter: AdapterType.Json,
    path: "./data",
  },
  migrationsDir: "./migrations",
};

export function initCommand(options: { force?: boolean }) {
  const cwd = process.cwd();
  const existing = findConfigFile(cwd);

  if (existing && !options.force) {
    logger.warn(`Config already exists at ${path.relative(cwd, existing)}`);
    logger.dim("Use --force to overwrite");
    return;
  }

  const configPath = path.join(cwd, "seedorm.config.json");
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
  logger.success("Created seedorm.config.json");

  // Create data directory
  const dataDir = path.join(cwd, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.success("Created data/ directory");
  }

  // Create migrations directory
  const migrationsDir = path.join(cwd, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    logger.success("Created migrations/ directory");
  }

  logger.info("Run `seedorm start` to launch the dev server");
}
