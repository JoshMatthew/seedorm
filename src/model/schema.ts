import type {
  FieldDefinition,
  FieldType,
  NormalizedField,
  NormalizedSchema,
  SchemaDefinition,
} from "../types.js";
import { ValidationError } from "../errors.js";
import { coerceFieldValue, validateFieldType } from "./field-types.js";

export function normalizeSchema(schema: SchemaDefinition): NormalizedSchema {
  const normalized: NormalizedSchema = {};

  for (const [field, def] of Object.entries(schema)) {
    if (typeof def === "string") {
      normalized[field] = {
        type: def as FieldType,
        required: false,
        unique: false,
        index: false,
      };
    } else {
      const d = def as FieldDefinition;
      normalized[field] = {
        type: d.type,
        required: d.required ?? false,
        unique: d.unique ?? false,
        index: d.index ?? d.unique ?? false,
        ...(d.default !== undefined && { default: d.default }),
        ...(d.minLength !== undefined && { minLength: d.minLength }),
        ...(d.maxLength !== undefined && { maxLength: d.maxLength }),
        ...(d.min !== undefined && { min: d.min }),
        ...(d.max !== undefined && { max: d.max }),
        ...(d.enum !== undefined && { enum: d.enum }),
      };
    }
  }

  return normalized;
}

export function validateDocument(
  data: Record<string, unknown>,
  schema: NormalizedSchema,
  isUpdate = false,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [field, def] of Object.entries(schema)) {
    let value = data[field];

    // Apply default
    if (value === undefined && def.default !== undefined && !isUpdate) {
      value =
        typeof def.default === "function"
          ? (def.default as () => unknown)()
          : def.default;
    }

    // Required check (skip on partial updates)
    if (!isUpdate && def.required && (value === undefined || value === null)) {
      throw new ValidationError(field, "field is required");
    }

    // Skip unset fields on update
    if (value === undefined) continue;

    // Type check
    const typeErr = validateFieldType(value, def.type);
    if (typeErr) throw new ValidationError(field, typeErr);

    // String constraints
    if (def.type === "string" && typeof value === "string") {
      if (def.minLength !== undefined && value.length < def.minLength) {
        throw new ValidationError(
          field,
          `minimum length is ${def.minLength}, got ${value.length}`,
        );
      }
      if (def.maxLength !== undefined && value.length > def.maxLength) {
        throw new ValidationError(
          field,
          `maximum length is ${def.maxLength}, got ${value.length}`,
        );
      }
    }

    // Number constraints
    if (def.type === "number" && typeof value === "number") {
      if (def.min !== undefined && value < def.min) {
        throw new ValidationError(field, `minimum value is ${def.min}`);
      }
      if (def.max !== undefined && value > def.max) {
        throw new ValidationError(field, `maximum value is ${def.max}`);
      }
    }

    // Enum check
    if (def.enum && !def.enum.includes(value)) {
      throw new ValidationError(
        field,
        `value must be one of: ${def.enum.join(", ")}`,
      );
    }

    result[field] = coerceFieldValue(value, def.type);
  }

  // On update, pass through non-schema fields that were provided
  // (for id, createdAt, updatedAt)
  if (isUpdate) {
    for (const [key, val] of Object.entries(data)) {
      if (!(key in schema) && val !== undefined) {
        result[key] = val;
      }
    }
  }

  return result;
}
