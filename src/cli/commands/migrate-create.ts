import * as path from "node:path";
import { loadConfig } from "../util/config-loader.js";
import { logger } from "../util/logger.js";
import { SeedORM } from "../../seedorm.js";
import { MigrationEngine } from "../../migration/migration-engine.js";
import { generateMigration } from "../../migration/migration-generator.js";
import type { MigrationStep } from "../../types.js";

export async function migrateCreateCommand(
  name: string,
  options: { empty?: boolean },
) {
  const config = loadConfig();
  const migrationsDir = config.migrationsDir ?? "./migrations";

  const steps: MigrationStep[] = [];

  if (!options.empty) {
    logger.dim("Creating empty migration (use schema diffing for auto-generation)");
  }

  const migration = generateMigration(name, steps);
  const db = new SeedORM(config);
  await db.connect();

  const engine = new MigrationEngine(db.getAdapter(), migrationsDir);
  const filePath = engine.saveMigration(migration);

  await db.disconnect();

  logger.success(`Created migration: ${path.relative(process.cwd(), filePath)}`);
  logger.dim(`Edit the migration file to add your up/down steps`);
}
