import type { Migration, MigrationStep } from "../types.js";
import { invertSteps } from "./schema-differ.js";

export function generateMigration(
  name: string,
  upSteps: MigrationStep[],
): Migration {
  const timestamp = Date.now();
  const id = `${timestamp}_${name.replace(/\s+/g, "_").toLowerCase()}`;

  return {
    id,
    name,
    timestamp,
    up: upSteps,
    down: invertSteps(upSteps),
  };
}

export function migrationToFileContent(migration: Migration): string {
  return JSON.stringify(migration, null, 2) + "\n";
}
