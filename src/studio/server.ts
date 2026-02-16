import * as http from "node:http";
import * as path from "node:path";
import { createApiHandler } from "./api.js";
import { getStaticContent } from "./static-content.js";
import type { SeedORM } from "../seedorm.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  let urlPath = new URL(req.url ?? "/", "http://localhost").pathname;
  if (urlPath === "/" || urlPath === "/studio") urlPath = "/index.html";

  // Remove leading slash
  const fileName = urlPath.slice(1);
  const content = getStaticContent(fileName);
  if (!content) return false;

  const ext = path.extname(fileName);
  const contentType = MIME_TYPES[ext] ?? "text/plain";

  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
  return true;
}

export function createStudioServer(
  db: SeedORM,
  port: number,
): http.Server {
  const apiHandler = createApiHandler(db);

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? "/";

    // API routes
    if (url.startsWith("/api/")) {
      await apiHandler(req, res);
      return;
    }

    // Static files
    if (serveStatic(req, res)) return;

    // Fallback to index.html for SPA
    const indexContent = getStaticContent("index.html");
    if (indexContent) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(indexContent);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return server;
}
