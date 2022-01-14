import { suub, history } from "../../deps.ts";

export type ActiveRoute = {
  location: Location;
  Component: React.ComponentType;
  props: Record<string, unknown>;
};

export interface Router {
  readonly route: ActiveRoute;
  subscribe: suub.SubscribeMethod<ActiveRoute>;
  createHref(to: history.To): string;
  push(to: history.To): void;
  replace(to: history.To): void;
  go(delta: number): void;
  back(): void;
  forward(): void;
}
