import { nanoid } from "nanoid";
import type {
  Document,
  FilterQuery,
  FindOptions,
  ModelDefinition,
  NormalizedSchema,
  StorageAdapter,
} from "../types.js";
import { DocumentNotFoundError } from "../errors.js";
import { normalizeSchema, validateDocument } from "./schema.js";

export class Model {
  public readonly name: string;
  public readonly collection: string;
  public readonly schema: NormalizedSchema;
  public readonly prefix: string;
  private adapter: StorageAdapter;
  private timestamps: boolean;

  constructor(definition: ModelDefinition, adapter: StorageAdapter) {
    this.name = definition.name;
    this.collection = definition.collection;
    this.schema = normalizeSchema(definition.schema);
    this.prefix = definition.prefix ?? definition.collection.slice(0, 3);
    this.adapter = adapter;
    this.timestamps = definition.timestamps !== false;
  }

  async init(): Promise<void> {
    await this.adapter.createCollection(this.collection, this.schema);
  }

  private generateId(): string {
    return `${this.prefix}_${nanoid(12)}`;
  }

  async create(data: Record<string, unknown>): Promise<Document> {
    const validated = validateDocument(data, this.schema);
    const now = new Date().toISOString();
    const doc: Document = {
      ...validated,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };
    return this.adapter.insert(this.collection, doc);
  }

  async createMany(
    items: Record<string, unknown>[],
  ): Promise<Document[]> {
    const results: Document[] = [];
    for (const item of items) {
      results.push(await this.create(item));
    }
    return results;
  }

  async findById(id: string): Promise<Document | null> {
    return this.adapter.findById(this.collection, id);
  }

  async findByIdOrThrow(id: string): Promise<Document> {
    const doc = await this.findById(id);
    if (!doc) throw new DocumentNotFoundError(this.collection, id);
    return doc;
  }

  async findOne(filter: FilterQuery): Promise<Document | null> {
    const results = await this.adapter.find(this.collection, {
      filter,
      limit: 1,
    });
    return results[0] ?? null;
  }

  async find(options: FindOptions = {}): Promise<Document[]> {
    return this.adapter.find(this.collection, options);
  }

  async findAll(): Promise<Document[]> {
    return this.adapter.find(this.collection, {});
  }

  async count(filter?: FilterQuery): Promise<number> {
    return this.adapter.count(this.collection, filter);
  }

  async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<Document | null> {
    const validated = validateDocument(data, this.schema, true);
    if (this.timestamps) {
      validated.updatedAt = new Date().toISOString();
    }
    return this.adapter.update(this.collection, id, validated);
  }

  async updateOrThrow(
    id: string,
    data: Record<string, unknown>,
  ): Promise<Document> {
    const doc = await this.update(id, data);
    if (!doc) throw new DocumentNotFoundError(this.collection, id);
    return doc;
  }

  async delete(id: string): Promise<boolean> {
    return this.adapter.delete(this.collection, id);
  }

  async deleteMany(filter: FilterQuery): Promise<number> {
    return this.adapter.deleteMany(this.collection, filter);
  }
}
