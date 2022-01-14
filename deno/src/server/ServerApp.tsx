// deno-lint-ignore-file no-explicit-any
import {
  history,
  nanoid,
  path as pathUtils,
  renderToString,
  React,
  zenjson,
  chemin,
} from "../../deps.ts";
import * as Pages from "../shared/Pages.ts";
import * as Route from "../shared/Route.ts";
import { ServerRouter } from "./ServerRouter.ts";
import { BRIDGE_DATA_ID, createBridgeData } from "../shared/Bridge.ts";
import { Root } from "../shared/Root.tsx";
import { notNil } from "../shared/Utils.ts";
import { SsrManifest } from "../shared/Route.ts";

export type RoutePath = history.Path;

export type SsrModule = { pages: Pages.Pages };

export type BuildOutput<Ssr extends SsrModule> = {
  indexHtml: string;
  ssr: Ssr;
  ssrManifest: SsrManifest;
};

export type PropsApiResult =
  | { kind: "props"; props: Record<string, unknown>; notFound?: boolean }
  | { kind: "redirect"; redirect: Pages.Redirect };

export type PageResolved =
  | {
      kind: "render";
      props: Record<string, any>;
      noProps: boolean;
      Component: React.ComponentType<any>;
      isNotFound: boolean;
      route: Route.Route;
      params: Record<string, unknown>;
    }
  | { kind: "redirect"; redirect: Pages.Redirect };

export type PropsResultResolved =
  | { kind: "noProps" }
  | { kind: "notFound" }
  | { kind: "redirect"; redirect: Pages.Redirect }
  | { kind: "props"; props: Record<string, unknown> };

export type RenderResult =
  | { kind: "redirect"; redirect: Pages.Redirect }
  | { kind: "render"; htmlContent: string; isNotFound: boolean };

export type EntxRouteResult =
  | { kind: "json"; data: unknown }
  | { kind: "file"; path: string }
  | { kind: "notFound" };

export type ServerAppOptions = {
  mode: "development" | "production";
  port: number;
};

export class ServerApp<Ssr extends SsrModule> {
  private port: number;
  private mode: "development" | "production";
  private buildOutput: BuildOutput<Ssr> | null = null;
  private buildOutputVersion = nanoid(10);

  constructor({ mode, port }: ServerAppOptions) {
    this.port = port;
    this.mode = mode;
  }

  public async render(path: RoutePath): Promise<RenderResult> {
    const resolved = await this.resolvePage(path);
    if (resolved.kind === "redirect") {
      return { kind: "redirect", redirect: resolved.redirect };
    }
    const { indexHtml } = await this.getBuildOutput();
    const router = new ServerRouter(path, resolved.Component, resolved.props);
    const content = this.renderToString(router);
    const assets = resolved.route.assets
      .map((asset) => `<script src="${asset}"></script>`)
      .join("\n");
    const bridge = createBridgeData({
      routeId: resolved.route.id,
      props: resolved.props,
      params: resolved.params,
      isNotFound: resolved.isNotFound,
      location: router.getStringLocation(),
    });
    const page = indexHtml
      .replace(`<!--app-html-->`, content)
      .replace(
        `<!--app-scripts-->`,
        `<script id="${BRIDGE_DATA_ID}" type="application/json">${bridge}</script>`
      )
      .replace(`<!--app-assets-->`, assets);
    return {
      kind: "render",
      htmlContent: page,
      isNotFound: resolved.isNotFound,
    };
  }

  /** */
  public async entxRoute(path: RoutePath): Promise<EntxRouteResult> {
    if (path.pathname.startsWith("/props")) {
      const body = await this.getProps({
        ...path,
        pathname: path.pathname.slice("/props".length),
      });
      return { kind: "json", data: body };
    }
    if (this.mode === "development") {
      if (path.pathname.startsWith("/dev/.entx/")) {
        const filePath = path.pathname.slice("/dev/.entx".length);
        return {
          kind: "file",
          path: pathUtils.resolve(Deno.cwd(), ".entx" + filePath),
        };
      }
      if (path.pathname === "/dev/invalidate") {
        this.invalidateBuildOutput();
        return { kind: "json", data: { ok: true } };
      }
    }
    return { kind: "notFound" };
  }

  public async getSsr(): Promise<Ssr> {
    return (await this.getBuildOutput()).ssr;
  }

  private async getBuildOutput(): Promise<BuildOutput<Ssr>> {
    return (
      this.buildOutput ?? (this.buildOutput = await this.fetchBuildOutput())
    );
  }

  private async fetchBuildOutput(): Promise<BuildOutput<Ssr>> {
    const devUrlBase = `http://localhost:${this.port}/_entx/dev`;

    const indexHtmlProm =
      this.mode === "production"
        ? Deno.readTextFile(
            pathUtils.resolve(Deno.cwd(), `.entx/client/index.html`)
          )
        : fetch(
            `${devUrlBase}/.entx/client/index.html?v=${this.buildOutputVersion}`
          ).then((r) => r.text());

    const ssrModuleProm: Promise<Ssr> =
      this.mode === "production"
        ? import(`.entx/server/ssr.js`)
        : import(
            `${devUrlBase}/.entx/server/ssr.js?v=${this.buildOutputVersion}`
          );

    const ssrManifestProm: Promise<SsrManifest> =
      this.mode === "production"
        ? import(`.entx/client/ssr-manifest.json`, { assert: { type: "json" } })
        : import(
            `${devUrlBase}/.entx/client/ssr-manifest.json?v=${this.buildOutputVersion}`,
            {
              assert: { type: "json" },
            }
          ).then((r) => r.default);

    const [indexHtml, ssrModule, ssrManifest] = await Promise.all([
      indexHtmlProm,
      ssrModuleProm,
      ssrManifestProm,
    ]);

    return {
      indexHtml,
      ssr: ssrModule,
      ssrManifest,
    };
  }

  private invalidateBuildOutput() {
    this.buildOutputVersion = nanoid(10);
    this.buildOutput = null;
  }

  private renderToString(router: ServerRouter): string {
    try {
      return renderToString(<Root router={router} />);
    } catch (error) {
      return "";
    }
  }

  private async getProps(path: RoutePath): Promise<PropsApiResult> {
    const resolved = await this.resolvePage(path);
    const body = zenjson.sanitize(
      this.resolvePropsApiResult(resolved)
    ) as PropsApiResult;
    return body;
  }

  private resolvePropsApiResult(resolved: PageResolved): PropsApiResult {
    if (resolved.kind === "redirect") {
      return { kind: "redirect", redirect: resolved.redirect };
    }
    return {
      kind: "props",
      props: resolved.props,
      notFound: resolved.isNotFound,
    };
  }

  private async resolvePage(path: RoutePath): Promise<PageResolved> {
    const build = await this.getBuildOutput();
    const routes = Route.pagesToRoutes(build.ssr.pages, build.ssrManifest);
    const notFoundRouteMatch: Route.RouteMatch = {
      route: notNil(
        routes.find((route) => route.pattern.equal(chemin.Chemin.create("404")))
      ),
      params: {},
      isNotFound: true,
    };
    if (path.hash || path.search) {
      throw new Error("Hash and search params are not supported yet");
    }
    const match = Route.matchRoute(routes, path.pathname) ?? notFoundRouteMatch;
    return this.resolveRouteMatch(match, notFoundRouteMatch);
  }

  private async resolveRouteMatch(
    routeMatch: Route.RouteMatch,
    notFoundRouteMatch: Route.RouteMatch
  ): Promise<PageResolved> {
    const { route, params } = routeMatch;
    const { getServerSideProps, default: Component } = await route.module();
    const context: Pages.GetServerSidePropsContext<any> = {
      query: params,
    };
    const propsResult = await this.resolveProps(getServerSideProps, context);
    if (propsResult.kind === "notFound") {
      return this.resolveRouteMatch(notFoundRouteMatch, notFoundRouteMatch);
    }
    if (propsResult.kind === "redirect") {
      return { kind: "redirect", redirect: propsResult.redirect };
    }
    const props = propsResult.kind === "noProps" ? {} : propsResult.props;
    return {
      kind: "render",
      props,
      noProps: propsResult.kind === "noProps",
      Component,
      isNotFound: routeMatch.isNotFound ?? false,
      route,
      params,
    };
  }

  private async resolveProps(
    getServerSideProps: Pages.GetServerSideProps | undefined,
    context: Pages.GetServerSidePropsContext<any>
  ): Promise<PropsResultResolved> {
    if (!getServerSideProps) {
      return { kind: "noProps" };
    }
    const result = await getServerSideProps(context);
    if ("notFound" in result) {
      return { kind: "notFound" };
    }
    if ("redirect" in result) {
      return { kind: "redirect", redirect: result.redirect };
    }
    return { kind: "props", props: result.props };
  }
}
