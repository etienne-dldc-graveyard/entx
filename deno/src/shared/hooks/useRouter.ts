// deno-lint-ignore-file no-explicit-any
import { React } from "../../../deps.ts";
import { Router } from "../Router.ts";
import { notNil } from "../Utils.ts";

export const RouterContext = React.createContext<Router>(null as any);

export function useRouter(): Router {
  return notNil(React.useContext(RouterContext));
}
