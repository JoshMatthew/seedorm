import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SeedORM } from "../../src/seedorm.js";
import { ValidationError, DocumentNotFoundError, UniqueConstraintError } from "../../src/errors.js";

let tmpDir: string;
let db: SeedORM;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedorm-orm-"));
  db = new SeedORM({ adapter: { adapter: "json", path: tmpDir } });
  await db.connect();
});

afterEach(async () => {
  await db.disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("SeedORM ORM flow", () => {
  it("creates a model and does CRUD", async () => {
    const User = db.model({
      name: "User",
      collection: "users",
      schema: {
        name: { type: "string", required: true },
        email: { type: "string", unique: true },
        age: "number",
      },
      prefix: "usr",
    });
    await User.init();

    // Create
    const alice = await User.create({ name: "Alice", email: "alice@test.com", age: 30 });
    expect(alice.id).toMatch(/^usr_/);
    expect(alice.name).toBe("Alice");
    expect(alice.createdAt).toBeTruthy();

    // Read
    const found = await User.findById(alice.id);
    expect(found).toEqual(alice);

    // Find with filter
    await User.create({ name: "Bob", email: "bob@test.com", age: 25 });
    const older = await User.find({ filter: { age: { $gte: 30 } } });
    expect(older).toHaveLength(1);
    expect(older[0]!.name).toBe("Alice");

    // findOne
    const bob = await User.findOne({ name: "Bob" });
    expect(bob!.name).toBe("Bob");

    // Count
    expect(await User.count()).toBe(2);
    expect(await User.count({ age: { $gt: 28 } })).toBe(1);

    // Update
    const updated = await User.update(alice.id, { age: 31 });
    expect(updated!.age).toBe(31);

    // Delete
    expect(await User.delete(bob!.id)).toBe(true);
    expect(await User.count()).toBe(1);
  });

  it("validates on create", async () => {
    const User = db.model({
      name: "User2",
      collection: "users2",
      schema: {
        name: { type: "string", required: true, minLength: 2 },
      },
    });
    await User.init();

    await expect(User.create({})).rejects.toThrow(ValidationError);
    await expect(User.create({ name: "A" })).rejects.toThrow(ValidationError);
  });

  it("validates on update", async () => {
    const User = db.model({
      name: "User3",
      collection: "users3",
      schema: {
        name: { type: "string", required: true },
        age: { type: "number", min: 0 },
      },
    });
    await User.init();

    const doc = await User.create({ name: "Test", age: 10 });
    await expect(User.update(doc.id, { age: -1 })).rejects.toThrow(ValidationError);
  });

  it("enforces unique constraints", async () => {
    const User = db.model({
      name: "User4",
      collection: "users4",
      schema: {
        email: { type: "string", unique: true },
      },
    });
    await User.init();

    await User.create({ email: "dup@test.com" });
    await expect(User.create({ email: "dup@test.com" })).rejects.toThrow(UniqueConstraintError);
  });

  it("findByIdOrThrow throws on missing", async () => {
    const User = db.model({
      name: "User5",
      collection: "users5",
      schema: { name: "string" },
    });
    await User.init();

    await expect(User.findByIdOrThrow("nonexistent")).rejects.toThrow(DocumentNotFoundError);
  });

  it("createMany inserts multiple docs", async () => {
    const User = db.model({
      name: "User6",
      collection: "users6",
      schema: { name: { type: "string", required: true } },
    });
    await User.init();

    const docs = await User.createMany([
      { name: "A" }, { name: "B" }, { name: "C" },
    ]);
    expect(docs).toHaveLength(3);
    expect(await User.count()).toBe(3);
  });

  it("deleteMany removes filtered docs", async () => {
    const User = db.model({
      name: "User7",
      collection: "users7",
      schema: { name: "string", age: "number" },
    });
    await User.init();

    await User.createMany([
      { name: "A", age: 20 },
      { name: "B", age: 30 },
      { name: "C", age: 40 },
    ]);

    const deleted = await User.deleteMany({ age: { $gte: 30 } });
    expect(deleted).toBe(2);
    expect(await User.count()).toBe(1);
  });

  it("findAll returns everything", async () => {
    const User = db.model({
      name: "User8",
      collection: "users8",
      schema: { name: "string" },
    });
    await User.init();

    await User.createMany([{ name: "A" }, { name: "B" }]);
    const all = await User.findAll();
    expect(all).toHaveLength(2);
  });
});
