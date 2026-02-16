import * as http from "node:http";
import type { SeedORM } from "../seedorm.js";
import type { Document, FilterQuery, FindOptions } from "../types.js";
import { SeedORMError } from "../errors.js";
import { nanoid } from "nanoid";

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createApiHandler(
  db: SeedORM,
): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
  return async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      const adapter = db.getAdapter();

      // GET /api/collections
      if (req.method === "GET" && parts[1] === "collections" && parts.length === 2) {
        const cols = await adapter.listCollections();
        const result = [];
        for (const col of cols) {
          if (col.startsWith("_seedorm_")) continue;
          const count = await adapter.count(col);
          result.push({ name: col, count });
        }
        return json(res, 200, { collections: result });
      }

      // CRUD: /api/data/:collection/:id?
      if (parts[1] === "data" && parts[2]) {
        const collection = parts[2];
        const id = parts[3];

        switch (req.method) {
          case "GET": {
            if (id) {
              const doc = await adapter.findById(collection, id);
              if (!doc) return json(res, 404, { error: "Not found" });
              return json(res, 200, doc);
            }
            const filterParam = url.searchParams.get("filter");
            const limitParam = url.searchParams.get("limit");
            const offsetParam = url.searchParams.get("offset");
            const sortParam = url.searchParams.get("sort");

            const opts: FindOptions = {};
            if (filterParam) opts.filter = JSON.parse(filterParam) as FilterQuery;
            if (limitParam) opts.limit = parseInt(limitParam, 10);
            if (offsetParam) opts.offset = parseInt(offsetParam, 10);
            if (sortParam) opts.sort = JSON.parse(sortParam) as Record<string, 1 | -1>;

            const docs = await adapter.find(collection, opts);
            const total = await adapter.count(collection, opts.filter);
            return json(res, 200, { data: docs, total });
          }
          case "POST": {
            const body = (await parseBody(req)) as Record<string, unknown>;
            const now = new Date().toISOString();
            const doc: Document = {
              ...body,
              id: (body.id as string) ?? `doc_${nanoid(12)}`,
              createdAt: now,
              updatedAt: now,
            };
            const inserted = await adapter.insert(collection, doc);
            return json(res, 201, inserted);
          }
          case "PUT":
          case "PATCH": {
            if (!id) return json(res, 400, { error: "ID required" });
            const data = (await parseBody(req)) as Partial<Document>;
            data.updatedAt = new Date().toISOString();
            const updated = await adapter.update(collection, id, data);
            if (!updated) return json(res, 404, { error: "Not found" });
            return json(res, 200, updated);
          }
          case "DELETE": {
            if (!id) return json(res, 400, { error: "ID required" });
            const deleted = await adapter.delete(collection, id);
            if (!deleted) return json(res, 404, { error: "Not found" });
            return json(res, 200, { deleted: true });
          }
        }
      }

      json(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof SeedORMError ? err.message : "Internal server error";
      const status = err instanceof SeedORMError ? 400 : 500;
      json(res, status, { error: message });
    }
  };
}
