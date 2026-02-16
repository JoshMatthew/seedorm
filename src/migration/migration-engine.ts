import * as fs from "node:fs";
import * as path from "node:path";
import type { Migration, MigrationRecord, MigrationStep, NormalizedSchema, StorageAdapter } from "../types.js";
import { ProtoDBError } from "../errors.js";

const MIGRATIONS_COLLECTION = "_protodb_migrations";

export class MigrationEngine {
  private adapter: StorageAdapter;
  private migrationsDir: string;

  constructor(adapter: StorageAdapter, migrationsDir: string) {
    this.adapter = adapter;
    this.migrationsDir = path.resolve(migrationsDir);
  }

  async init(): Promise<void> {
    const collections = await this.adapter.listCollections();
    if (!collections.includes(MIGRATIONS_COLLECTION)) {
      await this.adapter.createCollection(MIGRATIONS_COLLECTION, {});
    }
  }

  loadMigrations(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) return [];

    const files = fs.readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    return files.map((f) => {
      const raw = fs.readFileSync(path.join(this.migrationsDir, f), "utf-8");
      return JSON.parse(raw) as Migration;
    });
  }

  async getApplied(): Promise<MigrationRecord[]> {
    const docs = await this.adapter.find(MIGRATIONS_COLLECTION, {
      sort: { appliedAt: 1 },
    });
    return docs.map((d) => ({
      id: d.id,
      name: d["name"] as string,
      appliedAt: d["appliedAt"] as string,
    }));
  }

  async getPending(): Promise<Migration[]> {
    const applied = await this.getApplied();
    const appliedIds = new Set(applied.map((r) => r.id));
    return this.loadMigrations().filter((m) => !appliedIds.has(m.id));
  }

  async up(count?: number): Promise<string[]> {
    const pending = await this.getPending();
    const toRun = count ? pending.slice(0, count) : pending;
    const applied: string[] = [];

    for (const migration of toRun) {
      await this.applySteps(migration.up);
      await this.adapter.insert(MIGRATIONS_COLLECTION, {
        id: migration.id,
        name: migration.name,
        appliedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      applied.push(migration.id);
    }

    return applied;
  }

  async status(): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
  }> {
    return {
      applied: await this.getApplied(),
      pending: await this.getPending(),
    };
  }

  private async applySteps(steps: MigrationStep[]): Promise<void> {
    for (const step of steps) {
      switch (step.type) {
        case "createCollection":
          await this.adapter.createCollection(step.collection, {});
          break;
        case "dropCollection":
          await this.adapter.dropCollection(step.collection);
          break;
        case "addField":
        case "alterField":
        case "dropField":
          // For JSON adapter, schema changes are implicit (no fixed columns)
          // For SQL adapters, these would generate ALTER TABLE statements
          break;
        case "addIndex":
        case "dropIndex":
          // Index management is adapter-specific
          break;
      }
    }
  }

  saveMigration(migration: Migration): string {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }
    const fileName = `${migration.id}.json`;
    const filePath = path.join(this.migrationsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(migration, null, 2) + "\n");
    return filePath;
  }
}
