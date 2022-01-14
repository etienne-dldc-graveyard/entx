// deno-lint-ignore-file ban-types no-explicit-any
import { React } from "../../deps.ts";

export type Redirect = { destination: string; permanent: boolean };

export type Path<Params> = { params: Params };

export type GetServerSidePropsResult<Props> =
  | { notFound: true }
  | { redirect: Redirect }
  | { props: Props };

export type GetServerSidePropsContext<Params> = {
  query: Params;
};

export type GetServerSideProps<Props = {}, Params = {}> = (
  context: GetServerSidePropsContext<Params>
) => Promise<GetServerSidePropsResult<Props>> | GetServerSidePropsResult<Props>;

export type PageModule = {
  getServerSideProps?: GetServerSideProps<any, any>;
  default: React.ComponentType<any>;
};

export type Page = {
  path: string;
  module: () => Promise<PageModule>;
};

export type Pages = Array<Page>;
