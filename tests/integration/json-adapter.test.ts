import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { JsonAdapter } from "../../src/adapters/json/json-adapter.js";
import { normalizeSchema } from "../../src/model/schema.js";
import { CollectionNotFoundError, UniqueConstraintError } from "../../src/errors.js";
import type { Document } from "../../src/types.js";

let tmpDir: string;
let dbPath: string;
let adapter: JsonAdapter;

const userSchema = normalizeSchema({
  name: { type: "string", required: true },
  email: { type: "string", unique: true },
  age: { type: "number", index: true },
});

function makeDoc(data: Record<string, unknown>): Document {
  return {
    id: `usr_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data,
  };
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedorm-test-"));
  dbPath = path.join(tmpDir, "db.json");
  adapter = new JsonAdapter(dbPath);
  await adapter.connect();
  await adapter.createCollection("users", userSchema);
});

afterEach(async () => {
  await adapter.disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("JsonAdapter", () => {
  it("creates and lists collections", async () => {
    const cols = await adapter.listCollections();
    expect(cols).toContain("users");
  });

  it("inserts and finds by id", async () => {
    const doc = makeDoc({ name: "Alice", email: "alice@test.com", age: 30 });
    await adapter.insert("users", doc);

    const found = await adapter.findById("users", doc.id);
    expect(found).toEqual(doc);
  });

  it("finds with filter", async () => {
    await adapter.insert("users", makeDoc({ name: "Alice", email: "a@t.com", age: 30 }));
    await adapter.insert("users", makeDoc({ name: "Bob", email: "b@t.com", age: 25 }));
    await adapter.insert("users", makeDoc({ name: "Charlie", email: "c@t.com", age: 35 }));

    const results = await adapter.find("users", { filter: { age: { $gte: 30 } } });
    expect(results).toHaveLength(2);
  });

  it("finds with sort, limit, offset", async () => {
    await adapter.insert("users", makeDoc({ name: "Alice", email: "a@t.com", age: 30 }));
    await adapter.insert("users", makeDoc({ name: "Bob", email: "b@t.com", age: 25 }));
    await adapter.insert("users", makeDoc({ name: "Charlie", email: "c@t.com", age: 35 }));

    const results = await adapter.find("users", {
      sort: { age: 1 },
      limit: 2,
      offset: 1,
    });
    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe("Alice");
  });

  it("counts documents", async () => {
    await adapter.insert("users", makeDoc({ name: "Alice", email: "a@t.com", age: 30 }));
    await adapter.insert("users", makeDoc({ name: "Bob", email: "b@t.com", age: 25 }));

    expect(await adapter.count("users")).toBe(2);
    expect(await adapter.count("users", { age: { $gt: 28 } })).toBe(1);
  });

  it("updates a document", async () => {
    const doc = makeDoc({ name: "Alice", email: "a@t.com", age: 30 });
    await adapter.insert("users", doc);

    const updated = await adapter.update("users", doc.id, {
      age: 31,
      updatedAt: new Date().toISOString(),
    });
    expect(updated!.age).toBe(31);
    expect(updated!.name).toBe("Alice");
  });

  it("returns null updating non-existent doc", async () => {
    const result = await adapter.update("users", "nonexistent", { age: 31 });
    expect(result).toBeNull();
  });

  it("deletes a document", async () => {
    const doc = makeDoc({ name: "Alice", email: "a@t.com", age: 30 });
    await adapter.insert("users", doc);

    expect(await adapter.delete("users", doc.id)).toBe(true);
    expect(await adapter.findById("users", doc.id)).toBeNull();
    expect(await adapter.delete("users", doc.id)).toBe(false);
  });

  it("deleteMany with filter", async () => {
    await adapter.insert("users", makeDoc({ name: "Alice", email: "a@t.com", age: 30 }));
    await adapter.insert("users", makeDoc({ name: "Bob", email: "b@t.com", age: 25 }));
    await adapter.insert("users", makeDoc({ name: "Charlie", email: "c@t.com", age: 35 }));

    const count = await adapter.deleteMany("users", { age: { $gte: 30 } });
    expect(count).toBe(2);
    expect(await adapter.count("users")).toBe(1);
  });

  it("enforces unique constraint on insert", async () => {
    await adapter.insert("users", makeDoc({ name: "Alice", email: "same@t.com", age: 30 }));
    await expect(
      adapter.insert("users", makeDoc({ name: "Bob", email: "same@t.com", age: 25 })),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("enforces unique constraint on update", async () => {
    await adapter.insert("users", makeDoc({ name: "Alice", email: "a@t.com", age: 30 }));
    const bob = makeDoc({ name: "Bob", email: "b@t.com", age: 25 });
    await adapter.insert("users", bob);

    await expect(
      adapter.update("users", bob.id, { email: "a@t.com" }),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("throws on missing collection", async () => {
    await expect(adapter.findById("nonexistent", "x")).rejects.toThrow(
      CollectionNotFoundError,
    );
  });

  it("drops a collection", async () => {
    await adapter.dropCollection("users");
    const cols = await adapter.listCollections();
    expect(cols).not.toContain("users");
  });

  it("persists data to disk", async () => {
    await adapter.insert("users", makeDoc({ name: "Alice", email: "a@t.com", age: 30 }));
    await adapter.disconnect();

    // Reload from disk
    const adapter2 = new JsonAdapter(dbPath);
    await adapter2.connect();
    await adapter2.createCollection("users", userSchema);
    expect(await adapter2.count("users")).toBe(1);
    await adapter2.disconnect();
  });
});
