import JoyCon from "joycon";
import path from "path";
import { bundleRequire } from "bundle-require";
import type { defineConfig } from "./main";

export async function loadEntxConfig(
  cwd: string
): Promise<{ path?: string; data?: ReturnType<typeof defineConfig> }> {
  const configJoycon = new JoyCon();
  const configPath = await configJoycon.resolve(
    ["entx.config.ts", "entx.config.js", "entx.config.cjs", "entx.config.mjs"],
    cwd,
    path.parse(cwd).root
  );

  if (!configPath) {
    return {};
  }

  const config = await bundleRequire({ filepath: configPath });
  return {
    path: configPath,
    data: config.mod.entx || config.mod.default || config.mod,
  };
}
