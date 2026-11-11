import type { APIRoute } from "astro";

import { absoluteUrl } from "../i18n/locales";
import { buildRobotsTxt } from "../seo/robots";

export const GET: APIRoute = () =>
  new Response(buildRobotsTxt(absoluteUrl("/sitemap.xml")), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
