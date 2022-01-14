import { React, history } from "../../../deps.ts";
import { useRouter } from "./useRouter.ts";

interface CreateLinkPropsResult {
  href: string;
  target: string | undefined;
  onClick: React.MouseEventHandler<HTMLAnchorElement>;
}

export type CreateLinkPropsOptions = {
  onClick?: (event: LinkEvent) => void;
  target?: string;
  replace?: boolean;
};

export type CreateLinkProps = (
  to: history.To,
  options?: CreateLinkPropsOptions
) => CreateLinkPropsResult;

type LinkEvent = React.MouseEvent<HTMLAnchorElement, MouseEvent>;

export function useCreateLinkProps(): CreateLinkProps {
  const router = useRouter();
  return React.useCallback(
    (to: history.To, options: CreateLinkPropsOptions = {}) => {
      const href = router.createHref(to);
      return {
        href,
        target: options.target,
        onClick: (event: LinkEvent) => {
          if (options.onClick) {
            options.onClick(event);
          }
          if (
            !event.defaultPrevented && // onClick prevented default
            event.button === 0 && // ignore everything but left clicks
            (!options.target || options.target === "_self") && // let browser handle "target=_blank" etc.
            !isModifiedEvent(event) // ignore clicks with modifier keys
          ) {
            event.preventDefault();
            if (options.replace) {
              router.replace(to);
            } else {
              router.push(to);
            }
          }
        },
      };
    },
    []
  );
}

function isModifiedEvent(
  event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
): boolean {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
