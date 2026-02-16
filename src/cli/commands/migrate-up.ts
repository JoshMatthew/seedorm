import { loadConfig } from "../util/config-loader.js";
import { logger } from "../util/logger.js";
import { ProtoDB } from "../../protodb.js";
import { MigrationEngine } from "../../migration/migration-engine.js";

export async function migrateUpCommand(options: { count?: string }) {
  const config = loadConfig();
  const db = new ProtoDB(config);
  await db.connect();

  const engine = new MigrationEngine(
    db.getAdapter(),
    config.migrationsDir ?? "./migrations",
  );
  await engine.init();

  const count = options.count ? parseInt(options.count, 10) : undefined;
  const applied = await engine.up(count);

  if (applied.length === 0) {
    logger.info("No pending migrations");
  } else {
    for (const id of applied) {
      logger.success(`Applied: ${id}`);
    }
    logger.info(`${applied.length} migration(s) applied`);
  }

  await db.disconnect();
}
