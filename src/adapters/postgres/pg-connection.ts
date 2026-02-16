import { AdapterError } from "../../errors.js";

// pg is an optional peer dependency
let pgModule: typeof import("pg") | null = null;

async function loadPg(): Promise<typeof import("pg")> {
  if (pgModule) return pgModule;
  try {
    pgModule = await import("pg");
    return pgModule;
  } catch {
    throw new AdapterError(
      "postgres",
      'The "pg" package is required for PostgreSQL. Install it with: npm install pg',
    );
  }
}

export class PgConnection {
  private pool: import("pg").Pool | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    const pg = await loadPg();
    this.pool = new pg.Pool({ connectionString: this.url });
    // Test the connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    if (!this.pool) {
      throw new AdapterError("postgres", "Not connected");
    }
    const result = await this.pool.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }
}
