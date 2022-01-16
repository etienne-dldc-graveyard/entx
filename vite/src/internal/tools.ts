import type { RollupWatcher, RollupWatcherEvent } from "rollup";
import { build, InlineConfig } from "vite";
import fse from "fs-extra";
import path from "path";
import react from "@vitejs/plugin-react";
import { denoPlugin } from "./denoPlugin";
import { removeExportsPlugin } from "./removeExportsPlugin";
import got from "got";

export function projectPath(...parts: Array<string>): string {
  return path.resolve(process.cwd(), ...parts);
}

function createConfig(
  mode: "development" | "production",
  config: InlineConfig
): InlineConfig {
  const importMap = fse.readJsonSync(projectPath("importmap.json"));
  const pagesDir = projectPath("src/pages");

  const baseConfig: InlineConfig = {
    configFile: false,
    mode,
    // logLevel: mode === "development" ? "silent" : "info",
    clearScreen: false,
    build: {
      watch: {},
    },
    plugins: [
      react({ jsxRuntime: "classic" }),
      removeExportsPlugin({
        match: (filepath, options) => {
          if (options && options.ssr) {
            return;
          }
          if (filepath.startsWith(pagesDir)) {
            return ["getServerSideProps"];
          }
        },
      }),
      denoPlugin({ importMap }),
    ],
  };
  return {
    ...baseConfig,
    ...config,
    build: {
      ...baseConfig.build,
      ...config.build,
    },
    plugins: [...(baseConfig.plugins ?? []), ...(config.plugins ?? [])],
  };
}

export function buildClient(mode: "development" | "production") {
  return createBuild(
    createConfig(mode, {
      build: {
        outDir: projectPath(".entx/client"),
        ssrManifest: true,
      },
    })
  );
}

export function buildServer(mode: "development" | "production") {
  return createBuild(
    createConfig(mode, {
      build: {
        outDir: projectPath(".entx/server"),
        ssr: "src/ssr.ts",
        rollupOptions: {
          output: {
            format: "esm",
          },
        },
      },
    })
  );
}

export async function notifyChanges(): Promise<void> {
  try {
    console.info(`=> Notify Changes`);
    await got.get("http://localhost:3001/_entx/dev/invalidate");
  } catch (error) {
    console.warn(`=> Dev server offline ?`);
  }
}

// create build and wait for first emit
async function createBuild(config: InlineConfig): Promise<RollupWatcher> {
  const watcher: RollupWatcher = (await build(config)) as any;
  return new Promise((resolve, reject) => {
    const onEvent = (event: RollupWatcherEvent) => {
      if (event.code === "BUNDLE_END") {
        watcher.off("event", onEvent);
        resolve(watcher);
        return;
      }
      if (event.code === "ERROR") {
        watcher.off("event", onEvent);
        reject(event.error);
        return;
      }
    };
    watcher.on("event", onEvent);
  });
}
