import { FieldType, RelationType, type NormalizedField, type NormalizedSchema, type Document, type RelationsDefinition } from "../../types.js";

function fieldToSQLType(field: NormalizedField): string {
  switch (field.type) {
    case FieldType.String:
      if (field.maxLength) return `VARCHAR(${field.maxLength})`;
      return "TEXT";
    case FieldType.Number:
      return "DOUBLE PRECISION";
    case FieldType.Boolean:
      return "BOOLEAN";
    case FieldType.Date:
      return "TIMESTAMPTZ";
    case FieldType.Json:
      return "JSONB";
    case FieldType.Array:
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

export function generateCreateTableWithRelationsSQL(
  collection: string,
  schema: NormalizedSchema,
  relations: RelationsDefinition,
): string {
  // Build a map of FK fields → referenced table
  const fkFields = new Map<string, string>();
  for (const rel of Object.values(relations)) {
    if (rel.type === RelationType.BelongsTo) {
      // The FK lives on this table and points to the related model's table
      // We use the model name as collection (caller should resolve properly)
      fkFields.set(rel.foreignKey, rel.model);
    }
  }

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
    const refTable = fkFields.get(name);
    if (refTable) {
      col += ` REFERENCES "${refTable}" ("id")`;
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

export function generateJoinTableSQL(
  joinCollection: string,
  foreignKey: string,
  relatedKey: string,
  sourceTable: string,
  relatedTable: string,
): string {
  const lines: string[] = [];
  lines.push(`CREATE TABLE IF NOT EXISTS "${joinCollection}" (`);
  lines.push(`  "id" TEXT PRIMARY KEY,`);
  lines.push(`  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),`);
  lines.push(`  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),`);
  lines.push(`  "${foreignKey}" TEXT NOT NULL REFERENCES "${sourceTable}" ("id"),`);
  lines.push(`  "${relatedKey}" TEXT NOT NULL REFERENCES "${relatedTable}" ("id"),`);
  lines.push(`  UNIQUE ("${foreignKey}", "${relatedKey}")`);
  lines.push(");");
  lines.push(
    `CREATE INDEX IF NOT EXISTS "idx_${joinCollection}_${foreignKey}" ON "${joinCollection}" ("${foreignKey}");`,
  );
  lines.push(
    `CREATE INDEX IF NOT EXISTS "idx_${joinCollection}_${relatedKey}" ON "${joinCollection}" ("${relatedKey}");`,
  );
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
  parts.push(`-- Export of "${collection}" from seedorm`);
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
