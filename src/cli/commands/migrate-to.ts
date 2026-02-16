import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "../util/config-loader.js";
import { logger } from "../util/logger.js";
import { ProtoDB } from "../../protodb.js";
import { normalizeSchema } from "../../model/schema.js";
import { generateExportSQL } from "../../migration/exporters/postgres-exporter.js";
import type { Document, NormalizedSchema } from "../../types.js";

export async function migrateToCommand(
  target: string,
  options: { output?: string; collection?: string },
) {
  if (target !== "postgres") {
    logger.error(`Unsupported target: ${target}. Currently only "postgres" is supported.`);
    return;
  }

  const config = loadConfig();
  const db = new ProtoDB(config);
  await db.connect();

  const adapter = db.getAdapter();
  const collections = await adapter.listCollections();

  // Filter to specific collection if requested
  const toExport = options.collection
    ? collections.filter((c) => c === options.collection)
    : collections.filter((c) => !c.startsWith("_protodb_"));

  if (toExport.length === 0) {
    logger.warn("No collections to export");
    await db.disconnect();
    return;
  }

  const sqlParts: string[] = [];

  for (const collection of toExport) {
    const docs = await adapter.find(collection, {});

    // Infer schema from documents
    const schema = inferSchemaFromDocs(docs);

    sqlParts.push(generateExportSQL(collection, schema, docs));
    logger.info(`Exported "${collection}" (${docs.length} documents)`);
  }

  const sql = sqlParts.join("\n");

  if (options.output) {
    const outPath = path.resolve(options.output);
    fs.writeFileSync(outPath, sql);
    logger.success(`Written to ${path.relative(process.cwd(), outPath)}`);
  } else {
    console.log(sql);
  }

  await db.disconnect();
}

function inferSchemaFromDocs(docs: Document[]): NormalizedSchema {
  const schema: NormalizedSchema = {};

  for (const doc of docs) {
    for (const [key, value] of Object.entries(doc)) {
      if (key === "id" || key === "createdAt" || key === "updatedAt") continue;
      if (schema[key]) continue;

      schema[key] = {
        type: inferType(value),
        required: false,
        unique: false,
        index: false,
      };
    }
  }

  return schema;
}

function inferType(value: unknown): "string" | "number" | "boolean" | "json" | "array" | "date" {
  if (value === null || value === undefined) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "json";
  if (typeof value === "string") {
    if (!Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return "date";
    }
    return "string";
  }
  return "string";
}
