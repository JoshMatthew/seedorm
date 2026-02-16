import type {
  Document,
  FilterQuery,
  FindOptions,
  NormalizedSchema,
  StorageAdapter,
} from "../../types.js";
import { AdapterError, CollectionNotFoundError } from "../../errors.js";
import { applyFindOptions, countWithFilter } from "../../query/filter.js";
import { FileEngine } from "./file-engine.js";
import { Indexer } from "./indexer.js";

export class JsonAdapter implements StorageAdapter {
  private engine: FileEngine;
  private indexer = new Indexer();
  private schemas = new Map<string, NormalizedSchema>();

  constructor(filePath: string) {
    this.engine = new FileEngine(filePath);
  }

  async connect(): Promise<void> {
    await this.engine.load();
  }

  async disconnect(): Promise<void> {
    await this.engine.flushIfDirty();
  }

  async createCollection(
    collection: string,
    schema: NormalizedSchema,
  ): Promise<void> {
    this.engine.createCollection(collection);
    this.schemas.set(collection, schema);

    // Set up indexes
    for (const [field, def] of Object.entries(schema)) {
      if (def.index || def.unique) {
        this.indexer.setupIndex(
          collection,
          field,
          def.unique,
          this.engine.getCollection(collection),
        );
      }
    }

    await this.engine.flush();
  }

  async dropCollection(collection: string): Promise<void> {
    this.engine.dropCollection(collection);
    this.indexer.dropCollection(collection);
    this.schemas.delete(collection);
    await this.engine.flush();
  }

  async listCollections(): Promise<string[]> {
    return this.engine.listCollections();
  }

  async insert(collection: string, doc: Document): Promise<Document> {
    const docs = this.getCollectionOrThrow(collection);

    // Check unique constraints via indexer
    this.indexer.onInsert(collection, doc);

    docs.push(doc);
    this.engine.markDirty();
    await this.engine.flush();
    return doc;
  }

  async findById(
    collection: string,
    id: string,
  ): Promise<Document | null> {
    const docs = this.getCollectionOrThrow(collection);
    return docs.find((d) => d.id === id) ?? null;
  }

  async find(
    collection: string,
    options: FindOptions,
  ): Promise<Document[]> {
    const docs = this.getCollectionOrThrow(collection);
    return applyFindOptions(docs, options);
  }

  async count(collection: string, filter?: FilterQuery): Promise<number> {
    const docs = this.getCollectionOrThrow(collection);
    return countWithFilter(docs, filter);
  }

  async update(
    collection: string,
    id: string,
    data: Partial<Document>,
  ): Promise<Document | null> {
    const docs = this.getCollectionOrThrow(collection);
    const index = docs.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const oldDoc = docs[index]!;
    const newDoc = { ...oldDoc, ...data, id: oldDoc.id };

    // Check unique constraints
    this.indexer.onUpdate(collection, oldDoc, newDoc);

    docs[index] = newDoc;
    this.engine.markDirty();
    await this.engine.flush();
    return newDoc;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const docs = this.getCollectionOrThrow(collection);
    const index = docs.findIndex((d) => d.id === id);
    if (index === -1) return false;

    this.indexer.onDelete(collection, docs[index]!);
    docs.splice(index, 1);
    this.engine.markDirty();
    await this.engine.flush();
    return true;
  }

  async deleteMany(
    collection: string,
    filter: FilterQuery,
  ): Promise<number> {
    const docs = this.getCollectionOrThrow(collection);
    const matching = applyFindOptions(docs, { filter });

    for (const doc of matching) {
      this.indexer.onDelete(collection, doc);
    }

    const ids = new Set(matching.map((d) => d.id));
    const remaining = docs.filter((d) => !ids.has(d.id));
    const deleted = docs.length - remaining.length;

    // Replace array contents in-place
    docs.length = 0;
    docs.push(...remaining);

    if (deleted > 0) {
      this.engine.markDirty();
      await this.engine.flush();
    }

    return deleted;
  }

  private getCollectionOrThrow(collection: string): Document[] {
    if (!this.engine.hasCollection(collection)) {
      throw new CollectionNotFoundError(collection);
    }
    return this.engine.getCollection(collection);
  }
}
