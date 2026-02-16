export class SeedORMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedORMError";
  }
}

export class ValidationError extends SeedORMError {
  public field: string;
  public reason: string;

  constructor(field: string, reason: string) {
    super(`Validation error on "${field}": ${reason}`);
    this.name = "ValidationError";
    this.field = field;
    this.reason = reason;
  }
}

export class AdapterError extends SeedORMError {
  public adapter: string;

  constructor(adapter: string, message: string) {
    super(`[${adapter}] ${message}`);
    this.name = "AdapterError";
    this.adapter = adapter;
  }
}

export class CollectionNotFoundError extends SeedORMError {
  constructor(collection: string) {
    super(`Collection "${collection}" not found`);
    this.name = "CollectionNotFoundError";
  }
}

export class DocumentNotFoundError extends SeedORMError {
  constructor(collection: string, id: string) {
    super(`Document "${id}" not found in "${collection}"`);
    this.name = "DocumentNotFoundError";
  }
}

export class UniqueConstraintError extends SeedORMError {
  public field: string;
  public value: unknown;

  constructor(collection: string, field: string, value: unknown) {
    super(
      `Unique constraint violation on "${collection}.${field}": value ${JSON.stringify(value)} already exists`,
    );
    this.name = "UniqueConstraintError";
    this.field = field;
    this.value = value;
  }
}
