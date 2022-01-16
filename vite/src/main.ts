import type { RollupWatcherEvent } from "rollup";
import { Options } from "./options";
import { resolveEntxConfigSync } from "./load";
import {
  buildClient,
  buildServer,
  notifyChanges,
  projectPath,
} from "./internal/tools";
import fse from "fs-extra";
import { debounce } from "throttle-debounce";
import { resolveOptions } from "./options";

export const defineConfig = (
  options: Options | ((overrideOptions: Options) => Options)
) => options;

export async function entx(options: Options) {
  const config =
    options.config === false
      ? options
      : await resolveEntxConfigSync(process.cwd(), options);

  const resolved = await resolveOptions(config);

  // => Cleanup
  await fse.emptyDir(projectPath(".entx"));

  // => Building Client
  const client = await buildClient(resolved);

  // => Building Server
  const server = await buildServer(resolved);

  if (resolved.mode === "production") {
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
