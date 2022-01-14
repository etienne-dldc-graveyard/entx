import { React } from "../../deps.ts";
import { RouterContext } from "./hooks/useRouter.ts";
import { useIsomorphicLayoutEffect } from "./hooks/useIsomorphicLayoutEffect.ts";
import { ActiveRoute, Router } from "./Router.ts";

type Props = {
  router: Router;
};

export function Root({ router }: Props): JSX.Element {
  const [activeRoute, setActiveRoute] = React.useState<ActiveRoute>(
    () => router.route
  );

  useIsomorphicLayoutEffect(() => {
    return router.subscribe(setActiveRoute);
  }, []);

  const { Component, props } = activeRoute;

  return (
    <React.StrictMode>
      <RouterContext.Provider value={router}>
        <Component {...props} />
      </RouterContext.Provider>
    </React.StrictMode>
  );
}
