#!/usr/bin/env node
import { readFileSync } from "fs";
import { join } from "path";
import { cac } from "cac";
import { Options } from "./options";

main().catch(console.error);

export async function main(options: Options = {}) {
  const cli = cac("entx");

  cli.command("build", "Bundle your app with Vite").action(async () => {
    const { entx } = await import("./main");
    await entx({
      mode: "production",
    });
  });

  cli.command("dev", "Start a development server").action(async () => {
    const { entx } = await import("./main");
    await entx({
      mode: "development",
    });
  });

  cli.help();

  const pkgPath = join(__dirname, "../package.json");
  cli.version(JSON.parse(readFileSync(pkgPath, "utf8")).version);

  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
}
