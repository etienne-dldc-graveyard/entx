import { React, hydrate } from "../../deps.ts";
import type { Pages } from "../shared/Pages.ts";
import { getBridgeData } from "../shared/Bridge.ts";
import { Root } from "../shared/Root.tsx";
import { ClientRouter, OnServerSideProps } from "./ClientRouter.tsx";

export type ClientAppOptions = {
  rootEl: HTMLElement;
  onServerSideProps?: OnServerSideProps;
  pages: Pages;
};

export class ClientApp {
  public readonly router: ClientRouter;

  private readonly rootEl: HTMLElement;

  constructor({ onServerSideProps, rootEl, pages }: ClientAppOptions) {
    this.router = new ClientRouter({ onServerSideProps, pages });
    this.rootEl = rootEl;
  }

  async hydrate() {
    const { routeId, location, isNotFound, params, props } = getBridgeData();

    await this.router.initialize(routeId, location, isNotFound, params, props);

    hydrate(<Root router={this.router} />, this.rootEl);
  }
}
