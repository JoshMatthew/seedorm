import { loadConfig } from "../util/config-loader.js";
import { logger } from "../util/logger.js";
import { SeedORM } from "../../seedorm.js";
import { createStudioServer } from "../../studio/server.js";

export async function studioCommand(options: { port?: string }) {
  const port = parseInt(options.port ?? "4200", 10);
  const config = loadConfig();
  const db = new SeedORM(config);
  await db.connect();

  logger.success("Connected to database");

  const server = createStudioServer(db, port);
  server.listen(port, () => {
    logger.header("seedorm studio");
    logger.info(`Open http://localhost:${port} in your browser`);
  });

  const shutdown = async () => {
    logger.info("Shutting down...");
    server.close();
    await db.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
