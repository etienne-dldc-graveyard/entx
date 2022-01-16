import type { RollupWatcher, RollupWatcherEvent } from "rollup";
import { build, InlineConfig } from "vite";
import fse from "fs-extra";
import path from "path";
import react from "@vitejs/plugin-react";
import { denoPlugin } from "./denoPlugin";
import { removeExportsPlugin } from "./removeExportsPlugin";
import { OptionsResolved } from "../options";

export function projectPath(...parts: Array<string>): string {
  return path.resolve(process.cwd(), ...parts);
}

function createConfig(
  options: OptionsResolved,
  config: InlineConfig
): InlineConfig {
  const pagesDir = projectPath("src/pages");

  const baseConfig: InlineConfig = {
    configFile: false,
    mode: options.mode,
    // logLevel: mode === "development" ? "silent" : "info",
    clearScreen: false,
    build: {
      minify: options.mode === "production",
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
      denoPlugin({ importMap: options.importMap }),
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

export function buildClient(options: OptionsResolved) {
  return createBuild(
    createConfig(options, {
      build: {
        outDir: projectPath(".entx/client"),
        ssrManifest: true,
      },
    })
  );
}

export function buildServer(options: OptionsResolved) {
  return createBuild(
    createConfig(options, {
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
    const fetch = (await import("node-fetch")).default;
    await fetch("http://localhost:3001/_entx/dev/invalidate");
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
