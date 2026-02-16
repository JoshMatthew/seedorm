import type { Document } from "../../types.js";
import { UniqueConstraintError } from "../../errors.js";

interface FieldIndex {
  field: string;
  unique: boolean;
  map: Map<unknown, Set<string>>; // value → set of doc IDs
}

export class Indexer {
  private indexes = new Map<string, Map<string, FieldIndex>>(); // collection → field → index

  setupIndex(
    collection: string,
    field: string,
    unique: boolean,
    docs: Document[],
  ): void {
    if (!this.indexes.has(collection)) {
      this.indexes.set(collection, new Map());
    }
    const colIndexes = this.indexes.get(collection)!;

    const idx: FieldIndex = { field, unique, map: new Map() };

    for (const doc of docs) {
      const val = doc[field];
      if (val === undefined || val === null) continue;
      if (!idx.map.has(val)) {
        idx.map.set(val, new Set());
      }
      idx.map.get(val)!.add(doc.id);
    }

    colIndexes.set(field, idx);
  }

  onInsert(collection: string, doc: Document): void {
    const colIndexes = this.indexes.get(collection);
    if (!colIndexes) return;

    for (const [, idx] of colIndexes) {
      const val = doc[idx.field];
      if (val === undefined || val === null) continue;

      if (idx.unique && idx.map.has(val) && idx.map.get(val)!.size > 0) {
        throw new UniqueConstraintError(collection, idx.field, val);
      }

      if (!idx.map.has(val)) {
        idx.map.set(val, new Set());
      }
      idx.map.get(val)!.add(doc.id);
    }
  }

  onUpdate(
    collection: string,
    oldDoc: Document,
    newDoc: Document,
  ): void {
    const colIndexes = this.indexes.get(collection);
    if (!colIndexes) return;

    for (const [, idx] of colIndexes) {
      const oldVal = oldDoc[idx.field];
      const newVal = newDoc[idx.field];

      if (oldVal === newVal) continue;

      // Remove old
      if (oldVal !== undefined && oldVal !== null) {
        idx.map.get(oldVal)?.delete(oldDoc.id);
      }

      // Add new
      if (newVal !== undefined && newVal !== null) {
        if (
          idx.unique &&
          idx.map.has(newVal) &&
          idx.map.get(newVal)!.size > 0
        ) {
          throw new UniqueConstraintError(collection, idx.field, newVal);
        }
        if (!idx.map.has(newVal)) {
          idx.map.set(newVal, new Set());
        }
        idx.map.get(newVal)!.add(newDoc.id);
      }
    }
  }

  onDelete(collection: string, doc: Document): void {
    const colIndexes = this.indexes.get(collection);
    if (!colIndexes) return;

    for (const [, idx] of colIndexes) {
      const val = doc[idx.field];
      if (val !== undefined && val !== null) {
        idx.map.get(val)?.delete(doc.id);
      }
    }
  }

  findByValue(
    collection: string,
    field: string,
    value: unknown,
  ): Set<string> | undefined {
    return this.indexes.get(collection)?.get(field)?.map.get(value);
  }

  dropCollection(collection: string): void {
    this.indexes.delete(collection);
  }
}
