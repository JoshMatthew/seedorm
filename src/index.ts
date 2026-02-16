export { ProtoDB } from "./protodb.js";
export { Model } from "./model/model.js";
export { JsonAdapter } from "./adapters/json/json-adapter.js";
export { PostgresAdapter } from "./adapters/postgres/postgres-adapter.js";
export { normalizeSchema, validateDocument } from "./model/schema.js";

// Types
export type {
  Document,
  FieldDefinition,
  FieldType,
  FilterQuery,
  FilterOperators,
  FindOptions,
  ModelDefinition,
  NormalizedField,
  NormalizedSchema,
  ProtoDBConfig,
  SchemaDefinition,
  SortOption,
  StorageAdapter,
  AdapterConfig,
  AdapterType,
  Migration,
  MigrationStep,
  MigrationRecord,
} from "./types.js";

// Errors
export {
  ProtoDBError,
  ValidationError,
  AdapterError,
  CollectionNotFoundError,
  DocumentNotFoundError,
  UniqueConstraintError,
} from "./errors.js";
