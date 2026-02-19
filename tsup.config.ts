import { defineConfig } from "tsup";
import { cpSync, readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf-8"));

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
    entry: ["bin/seedorm.ts"],
    format: ["cjs"],
    outDir: "dist/bin",
    banner: { js: "#!/usr/bin/env node" },
    noExternal: [/.*/],
    define: { SEEDORM_VERSION: JSON.stringify(version) },
    onSuccess: async () => {
      // Copy static studio files
      cpSync("src/studio/static", "dist/bin/static", { recursive: true });
    },
  },
]);
