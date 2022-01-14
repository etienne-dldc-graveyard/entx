// deno-lint-ignore-file no-explicit-any
import type { Pages } from "../shared/Pages.ts";
import { history, chemin, suub, nanoid, zenjson } from "../../deps.ts";
import * as Route from "../shared/Route.ts";
import type { PropsApiResult } from "../server/ServerApp.tsx";
import { ActiveRoute, Router } from "../shared/Router.ts";
import { notNil } from "../shared/Utils.ts";

export type OnServerSideProps = (
  location: history.Location,
  props: any
) => void;

export type ClientRouterOptions = {
  onServerSideProps?: OnServerSideProps;
  pages: Pages;
};

/**
 * NextJS does fetch then navigate.
 * We do the opposite: navagate (while diplsaying the prev page) then fetch.
 */
export class ClientRouter implements Router {
  private readonly history = history.createBrowserHistory();
  private readonly onServerSideProps: OnServerSideProps;
  private readonly routes: Array<Route.Route>;
  private readonly notFoundRouteMatch: Route.RouteMatch;
  private readonly subscription = suub.Subscription<ActiveRoute>();

  private activeRoute: ActiveRoute | null = null;
  private requestId = "";

  constructor({ onServerSideProps, pages }: ClientRouterOptions) {
    this.routes = Route.pagesToRoutes(pages);
    const notFoundRoute = notNil(
      this.routes.find((route) =>
        route.pattern.equal(chemin.Chemin.create("404"))
      )
    );
    this.notFoundRouteMatch = {
      route: notFoundRoute,
      params: {},
      isNotFound: true,
    };
    this.onServerSideProps = onServerSideProps ?? (() => {});
    this.history.listen(this.onLocationChange.bind(this));
  }

  private onLocationChange({ location }: history.Update) {
    const nextRoute: Route.RouteMatch =
      Route.matchRoute(this.routes, location.pathname) ??
      this.notFoundRouteMatch;
    const requestId = nanoid(12);
    this.requestId = requestId;
    this.resolveRouteMatch(nextRoute, location).then(({ props, Component }) => {
      if (requestId !== this.requestId) {
        // canceled by another navigation
        return;
      }
      if (props.kind === "redirect") {
        this.replace(props.redirect.destination);
        return;
      }
      this.activeRoute = {
        location,
        Component,
        props: props.props,
      };
      this.subscription.emit(this.activeRoute);
    });
  }

  public readonly subscribe = this.subscription.subscribe;

  get location(): history.Location {
    return this.activeRoute?.location ?? this.history.location;
  }

  async initialize(
    routeId: string,
    serverLocation: string,
    isNotFound: boolean,
    params: Record<string, unknown>,
    prefetchedProps: Record<string, unknown>
  ): Promise<void> {
    // make sure server location match browser location
    if (serverLocation !== this.createHref(this.history.location)) {
      throw new Error(`Server location does not match browser location`);
    }
    const location = this.history.location;
    const route = notNil(this.routes.find((r) => r.id === routeId));
    const nextRoute: Route.RouteMatch = { route, params, isNotFound };
    const { props, Component } = await this.resolveRouteMatch(
      nextRoute,
      location,
      prefetchedProps
    );
    this.onServerSideProps(location, props);
    if (props.kind === "redirect") {
      throw new Error("Unexpected redirect on in itialize");
    }
    this.activeRoute = {
      location,
      Component,
      props: props.props,
    };
  }

  private async resolveRouteMatch(
    nextRoute: Route.RouteMatch,
    location: history.Location,
    prefetchedProps?: any
  ): Promise<{ Component: React.ComponentType; props: PropsApiResult }> {
    const [mod, props] = await Promise.all([
      nextRoute.route.module(),
      prefetchedProps
        ? Promise.resolve<PropsApiResult>({
            kind: "props",
            props: prefetchedProps,
            notFound: nextRoute.isNotFound,
          })
        : this.fetchProps(location),
    ]);
    return {
      Component: mod.default,
      props,
    };
  }

  private async fetchProps(
    location: history.Location
  ): Promise<PropsApiResult> {
    const req = `/_entx/props${this.createHref(location)}`;
    const res = await fetch(req);
    const d = await res.json();
    return zenjson.restore(d) as PropsApiResult;
  }

  get route(): ActiveRoute {
    if (!this.activeRoute) {
      throw new Error("Router not initialized");
    }
    return this.activeRoute;
  }

  createHref(to: history.To): string {
    return this.history.createHref(to);
  }

  push(to: history.To): void {
    return this.history.push(to);
  }

  replace(to: history.To): void {
    return this.history.replace(to);
  }

  go(delta: number): void {
    return this.history.go(delta);
  }

  back(): void {
    return this.history.back();
  }

  forward(): void {
    return this.history.forward();
  }
}
