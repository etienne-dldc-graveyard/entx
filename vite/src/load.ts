import JoyCon from "joycon";
import path from "path";
import { bundleRequire } from "bundle-require";
import type { defineConfig } from "./main";
import { Options } from "./options";

export async function loadEntxConfig(
  cwd: string
): Promise<{ path: string; data: ReturnType<typeof defineConfig> } | null> {
  const configJoycon = new JoyCon();
  const configPath = await configJoycon.resolve(
    ["entx.config.ts", "entx.config.js", "entx.config.cjs", "entx.config.mjs"],
    cwd,
    path.parse(cwd).root
  );

  if (!configPath) {
    return null;
  }

  const config = await bundleRequire({ filepath: configPath });
  return {
    path: configPath,
    data: config.mod.entx || config.mod.default || config.mod,
  };
}

export async function resolveEntxConfigSync(
  cwd: string,
  options: Options
): Promise<Options> {
  const loadedConfig = await loadEntxConfig(cwd);
  if (!loadedConfig) {
    return options;
  }
  if (typeof loadedConfig.data === "function") {
    return loadedConfig.data(options);
  }
  // TODO: deep merge ?
  return {
    ...options,
    ...loadedConfig.data,
  };
}
