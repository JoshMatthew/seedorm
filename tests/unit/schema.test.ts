import { describe, it, expect } from "vitest";
import { normalizeSchema, validateDocument } from "../../src/model/schema.js";
import { ValidationError } from "../../src/errors.js";

describe("normalizeSchema", () => {
  it("normalizes shorthand string types", () => {
    const schema = normalizeSchema({ name: "string", age: "number" });
    expect(schema.name).toEqual({
      type: "string",
      required: false,
      unique: false,
      index: false,
    });
  });

  it("normalizes full field definitions", () => {
    const schema = normalizeSchema({
      email: { type: "string", required: true, unique: true, maxLength: 255 },
    });
    expect(schema.email).toEqual({
      type: "string",
      required: true,
      unique: true,
      index: true,
      maxLength: 255,
    });
  });
});

describe("validateDocument", () => {
  const schema = normalizeSchema({
    name: { type: "string", required: true, minLength: 1, maxLength: 50 },
    age: { type: "number", min: 0, max: 150 },
    role: { type: "string", enum: ["admin", "user"] },
    active: { type: "boolean", default: true },
  });

  it("validates a correct document", () => {
    const result = validateDocument({ name: "Alice", age: 30, role: "admin" }, schema);
    expect(result.name).toBe("Alice");
    expect(result.active).toBe(true); // default applied
  });

  it("throws on missing required field", () => {
    expect(() => validateDocument({ age: 30 }, schema)).toThrow(ValidationError);
  });

  it("throws on wrong type", () => {
    expect(() => validateDocument({ name: 123 }, schema)).toThrow(ValidationError);
  });

  it("throws on string too short", () => {
    expect(() => validateDocument({ name: "" }, schema)).toThrow(ValidationError);
  });

  it("throws on string too long", () => {
    expect(() => validateDocument({ name: "x".repeat(51) }, schema)).toThrow(ValidationError);
  });

  it("throws on number out of range", () => {
    expect(() => validateDocument({ name: "Alice", age: -1 }, schema)).toThrow(ValidationError);
    expect(() => validateDocument({ name: "Alice", age: 200 }, schema)).toThrow(ValidationError);
  });

  it("throws on invalid enum value", () => {
    expect(() => validateDocument({ name: "Alice", role: "superadmin" }, schema)).toThrow(ValidationError);
  });

  it("allows partial updates", () => {
    const result = validateDocument({ age: 31 }, schema, true);
    expect(result.age).toBe(31);
    expect(result.name).toBeUndefined();
  });

  it("validates date fields", () => {
    const dateSchema = normalizeSchema({ birth: "date" });
    const result = validateDocument({ birth: "2024-01-01" }, dateSchema);
    expect(result.birth).toBe("2024-01-01");

    expect(() => validateDocument({ birth: "not-a-date" }, dateSchema)).toThrow(ValidationError);
  });

  it("coerces Date objects to ISO strings", () => {
    const dateSchema = normalizeSchema({ birth: "date" });
    const d = new Date("2024-06-15T00:00:00Z");
    const result = validateDocument({ birth: d }, dateSchema);
    expect(result.birth).toBe(d.toISOString());
  });
});
