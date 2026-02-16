// ── Field & Schema Types ──

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "json"
  | "array";

export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  index?: boolean;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: unknown[];
}

export interface SchemaDefinition {
  [field: string]: FieldType | FieldDefinition;
}

export interface NormalizedField {
  type: FieldType;
  required: boolean;
  unique: boolean;
  index: boolean;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: unknown[];
}

export interface NormalizedSchema {
  [field: string]: NormalizedField;
}

// ── Document ──

export interface Document {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ── Query / Filter ──

export interface FilterOperators {
  $eq?: unknown;
  $ne?: unknown;
  $gt?: number | string | Date;
  $gte?: number | string | Date;
  $lt?: number | string | Date;
  $lte?: number | string | Date;
  $in?: unknown[];
  $nin?: unknown[];
  $like?: string;
  $exists?: boolean;
}

export type FieldFilter = FilterOperators | unknown;

export interface FilterQuery {
  [field: string]: FieldFilter;
}

export interface SortOption {
  [field: string]: 1 | -1;
}

export interface FindOptions {
  filter?: FilterQuery;
  sort?: SortOption;
  limit?: number;
  offset?: number;
}

// ── Model Definition ──

export interface ModelDefinition {
  name: string;
  collection: string;
  schema: SchemaDefinition;
  timestamps?: boolean;
  prefix?: string;
}

// ── Storage Adapter ──

export interface StorageAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  insert(collection: string, doc: Document): Promise<Document>;
  findById(collection: string, id: string): Promise<Document | null>;
  find(collection: string, options: FindOptions): Promise<Document[]>;
  count(collection: string, filter?: FilterQuery): Promise<number>;
  update(
    collection: string,
    id: string,
    data: Partial<Document>,
  ): Promise<Document | null>;
  delete(collection: string, id: string): Promise<boolean>;
  deleteMany(collection: string, filter: FilterQuery): Promise<number>;

  createCollection(collection: string, schema: NormalizedSchema): Promise<void>;
  dropCollection(collection: string): Promise<void>;
  listCollections(): Promise<string[]>;
}

// ── Config ──

export type AdapterType = "json" | "postgres" | "mysql";

export interface JsonAdapterConfig {
  adapter: "json";
  path?: string;
}

export interface PostgresAdapterConfig {
  adapter: "postgres";
  url: string;
}

export interface MySQLAdapterConfig {
  adapter: "mysql";
  url: string;
}

export type AdapterConfig =
  | JsonAdapterConfig
  | PostgresAdapterConfig
  | MySQLAdapterConfig;

export interface SeedORMConfig {
  adapter: AdapterConfig;
  migrationsDir?: string;
}

// ── Migration ──

export interface MigrationStep {
  type:
    | "createCollection"
    | "dropCollection"
    | "addField"
    | "dropField"
    | "alterField"
    | "addIndex"
    | "dropIndex";
  collection: string;
  field?: string;
  schema?: NormalizedField;
  oldSchema?: NormalizedField;
}

export interface Migration {
  id: string;
  name: string;
  timestamp: number;
  up: MigrationStep[];
  down: MigrationStep[];
}

export interface MigrationRecord {
  id: string;
  name: string;
  appliedAt: string;
}
