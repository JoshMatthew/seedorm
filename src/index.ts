export { SeedORM } from "./seedorm.js";
export { Model } from "./model/model.js";
export { JsonAdapter } from "./adapters/json/json-adapter.js";
export { PostgresAdapter } from "./adapters/postgres/postgres-adapter.js";
export { normalizeSchema, validateDocument } from "./model/schema.js";

// Enums (value exports)
export { FieldType, RelationType, AdapterType } from "./types.js";

// Types
export type {
  Document,
  FieldDefinition,
  FilterQuery,
  FilterOperators,
  FindOptions,
  ModelDefinition,
  NormalizedField,
  NormalizedSchema,
  SeedORMConfig,
  SchemaDefinition,
  SortOption,
  StorageAdapter,
  AdapterConfig,
  Migration,
  MigrationStep,
  MigrationRecord,
  RelationDefinition,
  RelationsDefinition,
} from "./types.js";

// Errors
export {
  SeedORMError,
  ValidationError,
  AdapterError,
  CollectionNotFoundError,
  DocumentNotFoundError,
  UniqueConstraintError,
} from "./errors.js";
