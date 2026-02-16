import * as fs from "node:fs";
import * as path from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { Document } from "../../types.js";

export interface FileData {
  [collection: string]: Document[];
}

export class FileEngine {
  private filePath: string;
  private data: FileData = {};
  private writeQueue: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async load(): Promise<void> {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      this.data = JSON.parse(raw) as FileData;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.data = {};
        await this.flush();
      } else {
        throw err;
      }
    }
  }

  getData(): FileData {
    return this.data;
  }

  getCollection(name: string): Document[] {
    if (!this.data[name]) {
      this.data[name] = [];
    }
    return this.data[name];
  }

  hasCollection(name: string): boolean {
    return name in this.data;
  }

  createCollection(name: string): void {
    if (!this.data[name]) {
      this.data[name] = [];
    }
  }

  dropCollection(name: string): void {
    delete this.data[name];
  }

  listCollections(): string[] {
    return Object.keys(this.data);
  }

  markDirty(): void {
    this.dirty = true;
  }

  async flush(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await writeFileAtomic(
        this.filePath,
        JSON.stringify(this.data, null, 2) + "\n",
      );
      this.dirty = false;
    });
    return this.writeQueue;
  }

  async flushIfDirty(): Promise<void> {
    if (this.dirty) {
      await this.flush();
    }
  }
}
