import type {
  Document,
  FilterQuery,
  FindOptions,
  NormalizedField,
  NormalizedSchema,
  StorageAdapter,
} from "../../types.js";
import { CollectionNotFoundError } from "../../errors.js";
import { PgConnection } from "./pg-connection.js";
import { buildSelect, buildCount } from "./pg-query-builder.js";

function fieldToSQLType(field: NormalizedField): string {
  switch (field.type) {
    case "string":
      return field.maxLength ? `VARCHAR(${field.maxLength})` : "TEXT";
    case "number":
      return "DOUBLE PRECISION";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "TIMESTAMPTZ";
    case "json":
    case "array":
      return "JSONB";
    default:
      return "TEXT";
  }
}

export class PostgresAdapter implements StorageAdapter {
  private conn: PgConnection;

  constructor(url: string) {
    this.conn = new PgConnection(url);
  }

  async connect(): Promise<void> {
    await this.conn.connect();
  }

  async disconnect(): Promise<void> {
    await this.conn.disconnect();
  }

  async createCollection(
    collection: string,
    schema: NormalizedSchema,
  ): Promise<void> {
    const columns = [
      `"id" TEXT PRIMARY KEY`,
      `"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      `"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    ];

    for (const [name, def] of Object.entries(schema)) {
      let col = `"${name}" ${fieldToSQLType(def)}`;
      if (def.required) col += " NOT NULL";
      if (def.unique) col += " UNIQUE";
      columns.push(col);
    }

    await this.conn.query(
      `CREATE TABLE IF NOT EXISTS "${collection}" (${columns.join(", ")})`,
    );

    // Create indexes
    for (const [name, def] of Object.entries(schema)) {
      if (def.index && !def.unique) {
        await this.conn.query(
          `CREATE INDEX IF NOT EXISTS "idx_${collection}_${name}" ON "${collection}" ("${name}")`,
        );
      }
    }
  }

  async dropCollection(collection: string): Promise<void> {
    await this.conn.query(`DROP TABLE IF EXISTS "${collection}" CASCADE`);
  }

  async listCollections(): Promise<string[]> {
    const { rows } = await this.conn.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    return rows.map((r) => r.tablename);
  }

  async insert(collection: string, doc: Document): Promise<Document> {
    const keys = Object.keys(doc);
    const cols = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map((k) => {
      const v = doc[k];
      return typeof v === "object" && v !== null && !(v instanceof Date)
        ? JSON.stringify(v)
        : v;
    });

    const { rows } = await this.conn.query<Document>(
      `INSERT INTO "${collection}" (${cols}) VALUES (${placeholders}) RETURNING *`,
      values,
    );
    return rows[0]!;
  }

  async findById(
    collection: string,
    id: string,
  ): Promise<Document | null> {
    const { rows } = await this.conn.query<Document>(
      `SELECT * FROM "${collection}" WHERE "id" = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async find(
    collection: string,
    options: FindOptions,
  ): Promise<Document[]> {
    const q = buildSelect(collection, options);
    const { rows } = await this.conn.query<Document>(q.text, q.params);
    return rows;
  }

  async count(collection: string, filter?: FilterQuery): Promise<number> {
    const q = buildCount(collection, filter);
    const { rows } = await this.conn.query<{ count: string }>(
      q.text,
      q.params,
    );
    return parseInt(rows[0]!.count, 10);
  }

  async update(
    collection: string,
    id: string,
    data: Partial<Document>,
  ): Promise<Document | null> {
    const entries = Object.entries(data).filter(([k]) => k !== "id");
    if (entries.length === 0) return this.findById(collection, id);

    const sets = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
    const values = entries.map(([, v]) =>
      typeof v === "object" && v !== null && !(v instanceof Date)
        ? JSON.stringify(v)
        : v,
    );
    values.push(id);

    const { rows } = await this.conn.query<Document>(
      `UPDATE "${collection}" SET ${sets} WHERE "id" = $${values.length} RETURNING *`,
      values,
    );
    return rows[0] ?? null;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const { rowCount } = await this.conn.query(
      `DELETE FROM "${collection}" WHERE "id" = $1`,
      [id],
    );
    return rowCount > 0;
  }

  async deleteMany(
    collection: string,
    filter: FilterQuery,
  ): Promise<number> {
    const q = buildSelect(collection, { filter });
    // Convert SELECT to DELETE
    const deleteText = q.text.replace(/^SELECT \* FROM/, "DELETE FROM");
    const { rowCount } = await this.conn.query(deleteText, q.params);
    return rowCount;
  }
}
