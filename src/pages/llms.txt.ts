import type { APIRoute } from "astro";

import about from "../content/about.json";
import home from "../content/home.json";
import uses from "../content/uses.json";
import { buildLlmsTxt } from "../seo/llms";

export const GET: APIRoute = () =>
  new Response(
    buildLlmsTxt(home.en.meta.description, [
      { path: "/", en: home.en.meta, es: home.es.meta },
      {
        path: "/about/",
        en: {
          title: about.en.pageTitle,
          description: about.en.pageDescription,
        },
        es: {
          title: about.es.pageTitle,
          description: about.es.pageDescription,
        },
      },
      { path: "/uses/", en: uses.en.meta, es: uses.es.meta },
    ]),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
