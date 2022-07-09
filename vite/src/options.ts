import fse from "fs-extra";
import path from "path";

export type Options = {
  mode?: "development" | "production";
  /**
   * Path to import map files relative to cwd
   */
  importmap?: string;
  /**
   * Disable config file with `false`
   */
  config?: boolean;
};

export type OptionsResolved = {
  mode: "development" | "production";
  importMap: { imports: Record<string, string> };
};

export async function resolveOptions(
  options: Options
): Promise<OptionsResolved> {
  const mode = options.mode || "development";
  const importMap = options.importmap
    ? await fse.readJson(path.resolve(process.cwd(), options.importmap))
    : { imports: {} };

  console.log(importMap);

  return { mode, importMap };
}
