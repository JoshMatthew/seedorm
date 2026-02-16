import type {
  AdapterConfig,
  ModelDefinition,
  ProtoDBConfig,
  StorageAdapter,
} from "./types.js";
import { ProtoDBError } from "./errors.js";
import { Model } from "./model/model.js";
import { JsonAdapter } from "./adapters/json/json-adapter.js";
import * as path from "node:path";

export class ProtoDB {
  private config: ProtoDBConfig;
  private adapter: StorageAdapter | null = null;
  private models = new Map<string, Model>();
  private connected = false;

  constructor(config?: Partial<ProtoDBConfig>) {
    this.config = {
      adapter: config?.adapter ?? { adapter: "json", path: "./data" },
      migrationsDir: config?.migrationsDir ?? "./migrations",
    };
  }

  private async createAdapter(adapterConfig: AdapterConfig): Promise<StorageAdapter> {
    switch (adapterConfig.adapter) {
      case "json": {
        const dbPath = path.resolve(
          adapterConfig.path ?? "./data",
          "protodb.json",
        );
        return new JsonAdapter(dbPath);
      }
      case "postgres": {
        const { PostgresAdapter } = await import("./adapters/postgres/postgres-adapter.js");
        return new PostgresAdapter(adapterConfig.url);
      }
      case "mysql":
        throw new ProtoDBError(
          'MySQL adapter requires the "mysql2" package. Install it with: npm install mysql2',
        );
      default:
        throw new ProtoDBError(
          `Unknown adapter: ${(adapterConfig as { adapter: string }).adapter}`,
        );
    }
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.adapter = await this.createAdapter(this.config.adapter);
    await this.adapter.connect();
    this.connected = true;

    // Re-init existing models
    for (const model of this.models.values()) {
      await model.init();
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.adapter) return;
    await this.adapter.disconnect();
    this.connected = false;
    this.adapter = null;
  }

  model(definition: ModelDefinition): Model {
    if (this.models.has(definition.name)) {
      return this.models.get(definition.name)!;
    }

    if (!this.adapter) {
      throw new ProtoDBError(
        "Not connected. Call db.connect() before defining models.",
      );
    }

    const model = new Model(definition, this.adapter);
    this.models.set(definition.name, model);
    return model;
  }

  getModel(name: string): Model | undefined {
    return this.models.get(name);
  }

  getAdapter(): StorageAdapter {
    if (!this.adapter) {
      throw new ProtoDBError("Not connected.");
    }
    return this.adapter;
  }

  getConfig(): ProtoDBConfig {
    return this.config;
  }
}
