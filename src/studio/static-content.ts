import * as fs from "node:fs";
import * as path from "node:path";

const cache = new Map<string, string>();
let resolvedDir: string | null = null;

function findStaticDir(): string {
  if (resolvedDir !== null) return resolvedDir;

  // When bundled with tsup, __dirname points to dist/bin/
  // Static files are copied to dist/bin/static/
  const candidates = [
    path.resolve(__dirname, "static"),
    path.resolve(__dirname, "..", "studio", "static"),
    path.resolve(process.cwd(), "src", "studio", "static"),
  ];

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, "index.html"))) {
        resolvedDir = dir;
        return dir;
      }
    } catch {
      // ignore
    }
  }

  resolvedDir = "";
  return "";
}

export function getStaticContent(fileName: string): string | null {
  if (cache.has(fileName)) return cache.get(fileName)!;

  const dir = findStaticDir();
  if (!dir) return null;

  const filePath = path.resolve(dir, fileName);
  // Prevent directory traversal
  if (!filePath.startsWith(dir)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    cache.set(fileName, content);
    return content;
  } catch {
    return null;
  }
}
