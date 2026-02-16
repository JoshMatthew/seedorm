import type { FieldType } from "../types.js";

export function validateFieldType(
  value: unknown,
  type: FieldType,
): string | null {
  if (value === undefined || value === null) return null; // handled by required check

  switch (type) {
    case "string":
      if (typeof value !== "string") return `expected string, got ${typeof value}`;
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value))
        return `expected number, got ${typeof value}`;
      break;
    case "boolean":
      if (typeof value !== "boolean")
        return `expected boolean, got ${typeof value}`;
      break;
    case "date":
      if (typeof value === "string") {
        if (Number.isNaN(Date.parse(value))) return `invalid date string`;
      } else if (!(value instanceof Date)) {
        return `expected date string or Date, got ${typeof value}`;
      }
      break;
    case "json":
      // Any non-undefined value is valid JSON
      break;
    case "array":
      if (!Array.isArray(value)) return `expected array, got ${typeof value}`;
      break;
    default:
      return `unknown type: ${type as string}`;
  }

  return null;
}

export function coerceFieldValue(value: unknown, type: FieldType): unknown {
  if (value === undefined || value === null) return value;

  if (type === "date" && value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
