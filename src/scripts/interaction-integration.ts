import type { AstroIntegration } from "astro";

/**
 * Astro integration that adds the `client:interaction` directive: an island
 * hydrates on the first pointer, focus or touch interaction.
 * @returns The integration to list in `astro.config.mjs`.
 */
export default function interactionIntegration(): AstroIntegration {
  return {
    name: "client-interaction-directive",
    hooks: {
      "astro:config:setup": ({ addClientDirective }) => {
        addClientDirective({
          name: "interaction",
          entrypoint: new URL("hydrate-on-interaction.ts", import.meta.url),
        });
      },
    },
  };
}
