import type { NormalizedField, NormalizedSchema, Document } from "../../types.js";

function fieldToSQLType(field: NormalizedField): string {
  switch (field.type) {
    case "string":
      if (field.maxLength) return `VARCHAR(${field.maxLength})`;
      return "TEXT";
    case "number":
      return "DOUBLE PRECISION";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "TIMESTAMPTZ";
    case "json":
      return "JSONB";
    case "array":
      return "JSONB";
    default:
      return "TEXT";
  }
}

export function generateCreateTableSQL(
  collection: string,
  schema: NormalizedSchema,
): string {
  const lines: string[] = [];
  lines.push(`CREATE TABLE IF NOT EXISTS "${collection}" (`);
  lines.push(`  "id" TEXT PRIMARY KEY,`);
  const fields = Object.entries(schema);

  lines.push(`  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),`);
  lines.push(`  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()${fields.length > 0 ? "," : ""}`);

  for (let i = 0; i < fields.length; i++) {
    const [name, def] = fields[i]!;
    let col = `  "${name}" ${fieldToSQLType(def)}`;
    if (def.required) col += " NOT NULL";
    if (def.unique) col += " UNIQUE";
    if (def.default !== undefined && typeof def.default !== "function") {
      col += ` DEFAULT ${formatDefault(def.default, def)}`;
    }
    col += i < fields.length - 1 ? "," : "";
    lines.push(col);
  }

  lines.push(");");

  // Indexes
  for (const [name, def] of fields) {
    if (def.index && !def.unique) {
      lines.push(
        `CREATE INDEX IF NOT EXISTS "idx_${collection}_${name}" ON "${collection}" ("${name}");`,
      );
    }
  }

  return lines.join("\n");
}

function formatDefault(value: unknown, def: NormalizedField): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

export function generateInsertSQL(
  collection: string,
  doc: Document,
): string {
  const keys = Object.keys(doc);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const vals = keys
    .map((k) => {
      const v = doc[k];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      if (typeof v === "number") return String(v);
      if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
      return `'${String(v).replace(/'/g, "''")}'`;
    })
    .join(", ");

  return `INSERT INTO "${collection}" (${cols}) VALUES (${vals});`;
}

export function generateExportSQL(
  collection: string,
  schema: NormalizedSchema,
  docs: Document[],
): string {
  const parts: string[] = [];
  parts.push(`-- Export of "${collection}" from protodb`);
  parts.push(`-- Generated at ${new Date().toISOString()}\n`);
  parts.push(generateCreateTableSQL(collection, schema));
  parts.push("");

  if (docs.length > 0) {
    for (const doc of docs) {
      parts.push(generateInsertSQL(collection, doc));
    }
  }

  return parts.join("\n") + "\n";
}
