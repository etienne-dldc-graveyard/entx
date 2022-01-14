import type { RollupWatcherEvent } from "rollup";
import { Options } from "./options";
import { loadEntxConfig } from "./load";
import {
  buildClient,
  buildServer,
  notifyChanges,
  projectPath,
} from "./internal/tools";
import fse from "fs-extra";
import { debounce } from "throttle-debounce";

export const defineConfig = (
  options: Options | ((overrideOptions: Options) => Options)
) => options;

export async function entx(options: Options) {
  const { data: configData = {} } =
    options.config === false ? {} : await loadEntxConfig(process.cwd());
  const config =
    typeof configData === "function" ? configData(options) : configData;

  const mode = config.mode || "development";

  // => Cleanup
  await fse.emptyDir(projectPath(".entx"));

  // => Building Client
  const client = await buildClient(mode);

  // => Building Server
  const server = await buildServer(mode);

  if (mode === "production") {
    server.close();
    client.close();
    return;
  }

  const debouncedNotifyChanges = debounce(500, notifyChanges);

  const onEvent = (event: RollupWatcherEvent) => {
    if (event.code === "BUNDLE_END") {
      debouncedNotifyChanges();
    }
  };

  client.on("event", onEvent);
  server.on("event", onEvent);
}
