import { describe, it, expect } from "vitest";
import { applyFindOptions, matchesFilter, countWithFilter } from "../../src/query/filter.js";
import type { Document } from "../../src/types.js";

const docs: Document[] = [
  { id: "1", name: "Alice", age: 30, email: "alice@example.com", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "2", name: "Bob", age: 25, email: "bob@example.com", createdAt: "2024-01-02", updatedAt: "2024-01-02" },
  { id: "3", name: "Charlie", age: 35, email: "charlie@example.com", createdAt: "2024-01-03", updatedAt: "2024-01-03" },
  { id: "4", name: "Diana", age: 28, email: null as unknown as string, createdAt: "2024-01-04", updatedAt: "2024-01-04" },
];

describe("matchesFilter", () => {
  it("matches with shorthand equality", () => {
    expect(matchesFilter(docs[0]!, { name: "Alice" })).toBe(true);
    expect(matchesFilter(docs[0]!, { name: "Bob" })).toBe(false);
  });

  it("matches $eq", () => {
    expect(matchesFilter(docs[0]!, { age: { $eq: 30 } })).toBe(true);
  });

  it("matches $ne", () => {
    expect(matchesFilter(docs[0]!, { age: { $ne: 25 } })).toBe(true);
    expect(matchesFilter(docs[0]!, { age: { $ne: 30 } })).toBe(false);
  });

  it("matches $gt / $gte / $lt / $lte", () => {
    expect(matchesFilter(docs[0]!, { age: { $gt: 25 } })).toBe(true);
    expect(matchesFilter(docs[0]!, { age: { $gte: 30 } })).toBe(true);
    expect(matchesFilter(docs[0]!, { age: { $lt: 35 } })).toBe(true);
    expect(matchesFilter(docs[0]!, { age: { $lte: 30 } })).toBe(true);
    expect(matchesFilter(docs[0]!, { age: { $gt: 30 } })).toBe(false);
  });

  it("matches $in / $nin", () => {
    expect(matchesFilter(docs[0]!, { name: { $in: ["Alice", "Bob"] } })).toBe(true);
    expect(matchesFilter(docs[2]!, { name: { $in: ["Alice", "Bob"] } })).toBe(false);
    expect(matchesFilter(docs[2]!, { name: { $nin: ["Alice", "Bob"] } })).toBe(true);
  });

  it("matches $like", () => {
    expect(matchesFilter(docs[0]!, { email: { $like: "%@example.com" } })).toBe(true);
    expect(matchesFilter(docs[0]!, { email: { $like: "alice%" } })).toBe(true);
    expect(matchesFilter(docs[0]!, { email: { $like: "%bob%" } })).toBe(false);
  });

  it("matches $exists", () => {
    expect(matchesFilter(docs[0]!, { email: { $exists: true } })).toBe(true);
    expect(matchesFilter(docs[3]!, { email: { $exists: true } })).toBe(false);
    expect(matchesFilter(docs[3]!, { email: { $exists: false } })).toBe(true);
  });

  it("combines multiple operators", () => {
    expect(matchesFilter(docs[0]!, { age: { $gte: 25, $lte: 30 } })).toBe(true);
    expect(matchesFilter(docs[2]!, { age: { $gte: 25, $lte: 30 } })).toBe(false);
  });
});

describe("applyFindOptions", () => {
  it("filters documents", () => {
    const result = applyFindOptions(docs, { filter: { age: { $gt: 28 } } });
    expect(result).toHaveLength(2);
  });

  it("sorts ascending", () => {
    const result = applyFindOptions(docs, { sort: { age: 1 } });
    expect(result[0]!.name).toBe("Bob");
    expect(result[3]!.name).toBe("Charlie");
  });

  it("sorts descending", () => {
    const result = applyFindOptions(docs, { sort: { age: -1 } });
    expect(result[0]!.name).toBe("Charlie");
  });

  it("applies limit and offset", () => {
    const result = applyFindOptions(docs, { sort: { age: 1 }, limit: 2, offset: 1 });
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Diana");
    expect(result[1]!.name).toBe("Alice");
  });
});

describe("countWithFilter", () => {
  it("counts all without filter", () => {
    expect(countWithFilter(docs)).toBe(4);
  });

  it("counts with filter", () => {
    expect(countWithFilter(docs, { age: { $gte: 30 } })).toBe(2);
  });
});
