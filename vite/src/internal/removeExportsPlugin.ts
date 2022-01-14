import { Plugin } from "vite";
import { init, parse } from "es-module-lexer";
import { build } from "esbuild";

const JS_RE = /\.(js|jsx|ts|tsx|mjs|cjs|vue)$/;

type MatchFunction = (
  filepath: string,
  options?: { ssr?: boolean }
) => string[] | undefined | null | void;

const VIRTUAL_ENTRY = "/__VIRTUAL_ENTRY__";

export type Options = { match: MatchFunction };

export function removeExportsPlugin({ match }: Options): Plugin {
  return {
    name: "vite-plugin-remove-exports",
    enforce: "post",
    async transform(code, id, options) {
      const namesToExclude = JS_RE.test(id) && match(id, options);
      if (!namesToExclude || namesToExclude.length === 0) return null;

      if (/\bexport\s+\*\s+from\s+/.test(code)) {
        return this.error(`Please don't use export * from "mod" syntax`);
      }

      await init;
      const [, exportedNames] = parse(code);

      const filteredNames = exportedNames.filter(
        (name) => !namesToExclude.includes(name)
      );
      if (filteredNames.length > 0) {
        const result = await build({
          entryPoints: [VIRTUAL_ENTRY],
          bundle: true,
          format: "esm",
          outdir: "./none",
          write: false,
          sourcemap: true,
          plugins: [
            {
              name: "remove-exports",
              setup(build) {
                build.onResolve({ filter: /.*/ }, (args) => {
                  if (args.path === id || args.path === VIRTUAL_ENTRY) {
                    return {
                      path: args.path,
                    };
                  }
                  return {
                    external: true,
                  };
                });
                build.onLoad({ filter: /.*/ }, (args) => {
                  if (args.path === VIRTUAL_ENTRY) {
                    const contents = `export { ${filteredNames.join(
                      ", "
                    )} } from '${id}'`;
                    return { contents };
                  }
                  if (args.path === id) {
                    return {
                      contents: code,
                    };
                  }
                });
              },
            },
          ],
        });

        let jsCode = "";
        let map = "";
        for (const file of result.outputFiles) {
          if (file.path.endsWith(".js")) {
            jsCode = file.text;
          } else if (file.path.endsWith(".js.map")) {
            map = file.text;
          }
        }
        return {
          code: jsCode.replace(/^\/\/# sourceMappingURL=.+$/m, ""),
          map: map || undefined,
        };
      }

      return code;
    },
  };
}
