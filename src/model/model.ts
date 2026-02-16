import { nanoid } from "nanoid";
import {
  RelationType,
  type Document,
  type FilterQuery,
  type FindOptions,
  type ModelDefinition,
  type NormalizedSchema,
  type RelationDefinition,
  type RelationsDefinition,
  type StorageAdapter,
} from "../types.js";
import { DocumentNotFoundError, SeedORMError } from "../errors.js";
import { normalizeSchema, validateDocument } from "./schema.js";

interface SeedORMInstance {
  getModel(name: string): Model | undefined;
  getAdapter(): StorageAdapter;
}

export class Model {
  public readonly name: string;
  public readonly collection: string;
  public readonly schema: NormalizedSchema;
  public readonly prefix: string;
  public readonly relations: RelationsDefinition;
  private adapter: StorageAdapter;
  private timestamps: boolean;
  private db: SeedORMInstance | null;

  constructor(definition: ModelDefinition, adapter: StorageAdapter, db?: SeedORMInstance) {
    this.name = definition.name;
    this.collection = definition.collection;
    this.schema = normalizeSchema(definition.schema);
    this.prefix = definition.prefix ?? definition.collection.slice(0, 3);
    this.adapter = adapter;
    this.timestamps = definition.timestamps !== false;
    this.relations = definition.relations ?? {};
    this.db = db ?? null;
  }

  async init(): Promise<void> {
    await this.adapter.createCollection(this.collection, this.schema);
  }

  private generateId(): string {
    return `${this.prefix}_${nanoid(12)}`;
  }

  private resolveRelation(relationName: string): { rel: RelationDefinition; relatedModel: Model } {
    const rel = this.relations[relationName];
    if (!rel) {
      throw new SeedORMError(`Unknown relation "${relationName}" on model "${this.name}"`);
    }
    if (!this.db) {
      throw new SeedORMError("Cannot resolve relations without a SeedORM instance");
    }
    const relatedModel = this.db.getModel(rel.model);
    if (!relatedModel) {
      throw new SeedORMError(`Related model "${rel.model}" not found. Make sure it is defined before querying.`);
    }
    return { rel, relatedModel };
  }

  private async populate(docs: Document[], includeList: string[]): Promise<Document[]> {
    if (includeList.length === 0 || docs.length === 0) return docs;

    // Shallow-clone docs to avoid mutating the adapter's internal store
    docs = docs.map((d) => ({ ...d }));

    for (const relationName of includeList) {
      const { rel, relatedModel } = this.resolveRelation(relationName);

      switch (rel.type) {
        case RelationType.HasMany: {
          const parentIds = docs.map((d) => d.id);
          const related = await this.adapter.find(relatedModel.collection, {
            filter: { [rel.foreignKey]: { $in: parentIds } },
          });
          const grouped = new Map<string, Document[]>();
          for (const r of related) {
            const fk = r[rel.foreignKey] as string;
            if (!grouped.has(fk)) grouped.set(fk, []);
            grouped.get(fk)!.push(r);
          }
          for (const doc of docs) {
            doc[relationName] = grouped.get(doc.id) ?? [];
          }
          break;
        }

        case RelationType.HasOne: {
          const parentIds = docs.map((d) => d.id);
          const related = await this.adapter.find(relatedModel.collection, {
            filter: { [rel.foreignKey]: { $in: parentIds } },
          });
          const map = new Map<string, Document>();
          for (const r of related) {
            const fk = r[rel.foreignKey] as string;
            if (!map.has(fk)) map.set(fk, r);
          }
          for (const doc of docs) {
            doc[relationName] = map.get(doc.id) ?? null;
          }
          break;
        }

        case RelationType.BelongsTo: {
          const fkValues = [...new Set(docs.map((d) => d[rel.foreignKey] as string).filter(Boolean))];
          if (fkValues.length === 0) {
            for (const doc of docs) doc[relationName] = null;
            break;
          }
          const related = await this.adapter.find(relatedModel.collection, {
            filter: { id: { $in: fkValues } },
          });
          const map = new Map<string, Document>();
          for (const r of related) {
            map.set(r.id, r);
          }
          for (const doc of docs) {
            const fk = doc[rel.foreignKey] as string;
            doc[relationName] = map.get(fk) ?? null;
          }
          break;
        }

        case RelationType.ManyToMany: {
          if (!rel.joinCollection || !rel.relatedKey) {
            throw new SeedORMError(
              `manyToMany relation "${relationName}" requires joinCollection and relatedKey`,
            );
          }
          const parentIds = docs.map((d) => d.id);
          const joinRows = await this.adapter.find(rel.joinCollection, {
            filter: { [rel.foreignKey]: { $in: parentIds } },
          });
          const relatedIds = [...new Set(joinRows.map((r) => r[rel.relatedKey!] as string))];
          const relatedDocs =
            relatedIds.length > 0
              ? await this.adapter.find(relatedModel.collection, {
                  filter: { id: { $in: relatedIds } },
                })
              : [];
          const relatedMap = new Map<string, Document>();
          for (const r of relatedDocs) relatedMap.set(r.id, r);

          const grouped = new Map<string, Document[]>();
          for (const row of joinRows) {
            const parentId = row[rel.foreignKey] as string;
            const relatedId = row[rel.relatedKey!] as string;
            const relatedDoc = relatedMap.get(relatedId);
            if (relatedDoc) {
              if (!grouped.has(parentId)) grouped.set(parentId, []);
              grouped.get(parentId)!.push(relatedDoc);
            }
          }
          for (const doc of docs) {
            doc[relationName] = grouped.get(doc.id) ?? [];
          }
          break;
        }
      }
    }

    return docs;
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

  async findById(id: string, options?: { include?: string[] }): Promise<Document | null> {
    const doc = await this.adapter.findById(this.collection, id);
    if (!doc || !options?.include?.length) return doc;
    const [populated] = await this.populate([doc], options.include);
    return populated ?? null;
  }

  async findByIdOrThrow(id: string, options?: { include?: string[] }): Promise<Document> {
    const doc = await this.findById(id, options);
    if (!doc) throw new DocumentNotFoundError(this.collection, id);
    return doc;
  }

  async findOne(filter: FilterQuery, options?: { include?: string[] }): Promise<Document | null> {
    const results = await this.adapter.find(this.collection, {
      filter,
      limit: 1,
    });
    const doc = results[0] ?? null;
    if (!doc || !options?.include?.length) return doc;
    const [populated] = await this.populate([doc], options.include);
    return populated ?? null;
  }

  async find(options: FindOptions = {}): Promise<Document[]> {
    const { include, ...adapterOptions } = options;
    const docs = await this.adapter.find(this.collection, adapterOptions);
    if (!include?.length) return docs;
    return this.populate(docs, include);
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

  async associate(id: string, relationName: string, relatedId: string): Promise<Document> {
    const { rel } = this.resolveRelation(relationName);
    if (rel.type !== RelationType.ManyToMany) {
      throw new SeedORMError(`associate() is only supported for manyToMany relations, got "${rel.type}"`);
    }
    if (!rel.joinCollection || !rel.relatedKey) {
      throw new SeedORMError(
        `manyToMany relation "${relationName}" requires joinCollection and relatedKey`,
      );
    }
    const now = new Date().toISOString();
    const joinDoc: Document = {
      id: `${this.prefix}rel_${nanoid(12)}`,
      [rel.foreignKey]: id,
      [rel.relatedKey]: relatedId,
      createdAt: now,
      updatedAt: now,
    };
    return this.adapter.insert(rel.joinCollection, joinDoc);
  }

  async dissociate(id: string, relationName: string, relatedId: string): Promise<number> {
    const { rel } = this.resolveRelation(relationName);
    if (rel.type !== RelationType.ManyToMany) {
      throw new SeedORMError(`dissociate() is only supported for manyToMany relations, got "${rel.type}"`);
    }
    if (!rel.joinCollection || !rel.relatedKey) {
      throw new SeedORMError(
        `manyToMany relation "${relationName}" requires joinCollection and relatedKey`,
      );
    }
    return this.adapter.deleteMany(rel.joinCollection, {
      [rel.foreignKey]: id,
      [rel.relatedKey]: relatedId,
    });
  }
}
