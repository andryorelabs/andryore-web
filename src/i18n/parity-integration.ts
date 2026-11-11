import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

import { runParityCheck } from "./parity-check";

/**
 * Fails the build with every bilingual parity problem listed (ADR 0002).
 * @returns The Astro integration.
 */
export default function parityIntegration(): AstroIntegration {
  return {
    name: "bilingual-parity",
    hooks: {
      "astro:config:done": ({ config }) => {
        const root = fileURLToPath(config.root);
        const problems = runParityCheck(path.resolve(root));
        if (problems.length > 0) {
          throw new Error(
            `Bilingual parity check failed (ADR 0002):\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
          );
        }
      },
    },
  };
}
