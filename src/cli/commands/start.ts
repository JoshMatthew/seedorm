import * as http from "node:http";
import { ProtoDB } from "../../protodb.js";
import { loadConfig } from "../util/config-loader.js";
import { logger } from "../util/logger.js";
import type { Document, FilterQuery, FindOptions, ModelDefinition } from "../../types.js";
import { ProtoDBError } from "../../errors.js";

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
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export async function startCommand(options: { port?: string }) {
  const port = parseInt(options.port ?? "4100", 10);
  const config = loadConfig();
  const db = new ProtoDB(config);
  await db.connect();

  logger.success("Connected to database");

  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      // POST /api/models — register a model dynamically
      if (req.method === "POST" && parts[0] === "api" && parts[1] === "models" && parts.length === 2) {
        const body = (await parseBody(req)) as ModelDefinition;
        const model = db.model(body);
        await model.init();
        json(res, 201, { name: model.name, collection: model.collection });
        return;
      }

      // GET /api/collections — list collections
      if (req.method === "GET" && parts[0] === "api" && parts[1] === "collections" && parts.length === 2) {
        const adapter = db.getAdapter();
        const cols = await adapter.listCollections();
        json(res, 200, { collections: cols });
        return;
      }

      // REST: /api/:collection
      if (parts[0] === "api" && parts.length >= 2) {
        const collection = parts[1]!;
        const adapter = db.getAdapter();
        const id = parts[2];

        switch (req.method) {
          case "GET": {
            if (id) {
              const doc = await adapter.findById(collection, id);
              if (!doc) return json(res, 404, { error: "Not found" });
              return json(res, 200, doc);
            }
            // Parse query params for filter
            const filterParam = url.searchParams.get("filter");
            const limitParam = url.searchParams.get("limit");
            const offsetParam = url.searchParams.get("offset");
            const sortParam = url.searchParams.get("sort");

            const findOptions: FindOptions = {};
            if (filterParam) findOptions.filter = JSON.parse(filterParam) as FilterQuery;
            if (limitParam) findOptions.limit = parseInt(limitParam, 10);
            if (offsetParam) findOptions.offset = parseInt(offsetParam, 10);
            if (sortParam) findOptions.sort = JSON.parse(sortParam) as Record<string, 1 | -1>;

            const docs = await adapter.find(collection, findOptions);
            const total = await adapter.count(collection, findOptions.filter);
            return json(res, 200, { data: docs, total });
          }
          case "POST": {
            const body = (await parseBody(req)) as Document;
            const now = new Date().toISOString();
            const { nanoid } = await import("nanoid");
            const doc: Document = {
              ...body,
              id: body.id ?? `doc_${nanoid(12)}`,
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
      const message = err instanceof ProtoDBError ? err.message : "Internal server error";
      const status = err instanceof ProtoDBError ? 400 : 500;
      json(res, status, { error: message });
    }
  });

  server.listen(port, () => {
    logger.header("protodb dev server");
    logger.info(`Listening on http://localhost:${port}`);
    logger.dim("REST API: GET/POST/PUT/DELETE /api/:collection/:id");
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    server.close();
    await db.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
