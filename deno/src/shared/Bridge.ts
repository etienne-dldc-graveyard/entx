// deno-lint-ignore-file no-explicit-any
import { zenjson } from "../../deps.ts";

export type BridgeData = {
  props: Record<string, unknown>;
  routeId: string;
  location: string;
  isNotFound: boolean;
  params: Record<string, unknown>;
};

export const BRIDGE_DATA_ID = "__BRIDGE_DATA__";

export function createBridgeData(data: BridgeData): string {
  return JSON.stringify(zenjson.sanitize(data));
}

export function getBridgeData(): BridgeData {
  return zenjson.restore(
    JSON.parse(document.getElementById(BRIDGE_DATA_ID)!.textContent ?? "{}")
  ) as any;
}
