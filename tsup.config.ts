import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
  },
  {
    entry: ["bin/protodb.ts"],
    format: ["cjs"],
    outDir: "dist/bin",
    banner: { js: "#!/usr/bin/env node" },
    noExternal: [/.*/],
    onSuccess: async () => {
      // Copy static studio files
      cpSync("src/studio/static", "dist/bin/static", { recursive: true });
    },
  },
]);
