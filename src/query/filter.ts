import type { Document, FilterQuery, FindOptions, SortOption } from "../types.js";
import { applyOperator, isOperatorObject } from "./operators.js";

function matchesFilter(doc: Document, filter: FilterQuery): boolean {
  for (const [field, condition] of Object.entries(filter)) {
    const value = doc[field];

    if (isOperatorObject(condition)) {
      for (const [op, operand] of Object.entries(
        condition as Record<string, unknown>,
      )) {
        if (!applyOperator(op, value, operand)) return false;
      }
    } else {
      // Shorthand: { field: value } is equivalent to { field: { $eq: value } }
      if (value !== condition) return false;
    }
  }
  return true;
}

function sortDocuments(docs: Document[], sort: SortOption): Document[] {
  const entries = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      if (av === undefined || av === null) return dir;
      if (bv === undefined || bv === null) return -dir;
      if (av < bv) return -dir;
      if (av > bv) return dir;
    }
    return 0;
  });
}

export function applyFindOptions(
  docs: Document[],
  options: FindOptions,
): Document[] {
  let result = docs;

  if (options.filter) {
    result = result.filter((doc) => matchesFilter(doc, options.filter!));
  }

  if (options.sort) {
    result = sortDocuments(result, options.sort);
  }

  if (options.offset) {
    result = result.slice(options.offset);
  }

  if (options.limit !== undefined) {
    result = result.slice(0, options.limit);
  }

  return result;
}

export function countWithFilter(
  docs: Document[],
  filter?: FilterQuery,
): number {
  if (!filter) return docs.length;
  return docs.filter((doc) => matchesFilter(doc, filter)).length;
}

export { matchesFilter };
