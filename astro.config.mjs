import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

import parityIntegration from "./src/i18n/parity-integration";
import { UMAMI_GATEWAY_ORIGIN, UMAMI_SCRIPT_ORIGIN } from "./src/lib/analytics";
import interactionIntegration from "./src/scripts/interaction-integration";
import { THEME_INIT_SCRIPT_HASH } from "./src/scripts/theme-init";

export default defineConfig({
  site: "https://andryore.dev",
  trailingSlash: "always",
  prefetch: false,
  integrations: [react(), interactionIntegration(), parityIntegration()],
  security: {
    csp: {
      scriptDirective: {
        hashes: [THEME_INIT_SCRIPT_HASH],
        resources: ["'self'", UMAMI_SCRIPT_ORIGIN],
      },
      directives: [`connect-src 'self' ${UMAMI_GATEWAY_ORIGIN}`, "manifest-src 'self'"],
    },
  },
  markdown: { syntaxHighlight: false },
  build: { inlineStylesheets: "never" },
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
