import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { migrateCreateCommand } from "./commands/migrate-create.js";
import { migrateUpCommand } from "./commands/migrate-up.js";
import { migrateToCommand } from "./commands/migrate-to.js";
import { studioCommand } from "./commands/studio.js";

declare const SEEDORM_VERSION: string;

export function createCLI(): Command {
  const program = new Command();

  program
    .name("seedorm")
    .description("Development-first ORM — start with JSON, migrate to PostgreSQL/MySQL")
    .version(SEEDORM_VERSION);

  program
    .command("init")
    .description("Initialize a new seedorm project")
    .option("-f, --force", "Overwrite existing config")
    .action(initCommand);

  program
    .command("start")
    .description("Start the development REST API server")
    .option("-p, --port <port>", "Port to listen on", "4100")
    .action(startCommand);

  const migrate = program
    .command("migrate")
    .description("Migration commands");

  migrate
    .command("create <name>")
    .description("Create a new migration")
    .option("--empty", "Create an empty migration")
    .action(migrateCreateCommand);

  migrate
    .command("up")
    .description("Run pending migrations")
    .option("-c, --count <count>", "Number of migrations to run")
    .action(migrateUpCommand);

  migrate
    .command("to <target>")
    .description("Export data to target database (e.g., postgres)")
    .option("-o, --output <file>", "Output file path")
    .option("--collection <name>", "Export specific collection")
    .action(migrateToCommand);

  program
    .command("studio")
    .description("Launch the seedorm studio UI")
    .option("-p, --port <port>", "Port to listen on", "4200")
    .action(studioCommand);

  return program;
}
