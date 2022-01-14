import { Plugin } from "vite";
import { resolve } from "deno-importmap";
import { readFile } from "fs/promises";
import * as DenoCache from "../deno-cache/mod";

export type Options = {
  importMap: { imports: Record<string, string> };
};

export function denoPlugin({ importMap = { imports: {} } }: Options): Plugin {
  return {
    enforce: "pre",
    name: "vite-plugin-deno",
    resolveId(source, importer, { ssr }) {
      const resolvedId = resolve(source, importMap, importer);
      if (ssr) {
        if (resolvedId.startsWith("http")) {
          return { id: resolvedId, external: true };
        }

        // Temp while entx is local
        if (resolvedId === "./src/entx/mod.ts") {
          return { id: "entx", external: true };
        }
        if (resolvedId.match(/entx/)) {
          console.warn(`Internal entx import: ${resolvedId}`);
        }

        return resolvedId;
      }
      return resolvedId;
    },
    async load(id) {
      if (id.startsWith("http")) {
        const file = await DenoCache.cache(id, undefined, "deps");
        return await readFile(file.path, "utf8");
      }
      return null;
    },
  };
}
