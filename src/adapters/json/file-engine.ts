import * as fs from "node:fs";
import * as path from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { Document } from "../../types.js";

export class FileEngine {
  private dirPath: string;
  private data: Map<string, Document[]> = new Map();
  private dirty: Set<string> = new Set();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dirPath: string) {
    this.dirPath = path.resolve(dirPath);
  }

  async load(): Promise<void> {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }

    // Legacy migration: single seedorm.json → per-collection files
    const legacyPath = path.join(this.dirPath, "seedorm.json");
    if (fs.existsSync(legacyPath)) {
      const raw = fs.readFileSync(legacyPath, "utf-8");
      const legacy = JSON.parse(raw) as Record<string, Document[]>;
      for (const [collection, docs] of Object.entries(legacy)) {
        this.data.set(collection, docs);
        this.dirty.add(collection);
      }
      await this.flush();
      fs.unlinkSync(legacyPath);
      return;
    }

    // Read per-collection files
    const files = fs.readdirSync(this.dirPath).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const collection = file.slice(0, -5); // strip .json
      const raw = fs.readFileSync(path.join(this.dirPath, file), "utf-8");
      this.data.set(collection, JSON.parse(raw) as Document[]);
    }
  }

  getCollection(name: string): Document[] {
    if (!this.data.has(name)) {
      this.data.set(name, []);
    }
    return this.data.get(name)!;
  }

  hasCollection(name: string): boolean {
    return this.data.has(name);
  }

  createCollection(name: string): void {
    if (!this.data.has(name)) {
      this.data.set(name, []);
      this.dirty.add(name);
    }
  }

  dropCollection(name: string): void {
    this.data.delete(name);
    this.dirty.delete(name);
    const filePath = path.join(this.dirPath, `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  listCollections(): string[] {
    return Array.from(this.data.keys());
  }

  markDirty(collection: string): void {
    this.dirty.add(collection);
  }

  async flush(): Promise<void> {
    const toWrite = new Set(this.dirty);
    this.dirty.clear();

    this.writeQueue = this.writeQueue.then(async () => {
      for (const collection of toWrite) {
        const docs = this.data.get(collection);
        if (docs === undefined) continue;
        await writeFileAtomic(
          path.join(this.dirPath, `${collection}.json`),
          JSON.stringify(docs),
        );
      }
    });
    return this.writeQueue;
  }

  async flushIfDirty(): Promise<void> {
    if (this.dirty.size > 0) {
      await this.flush();
    }
  }
}
