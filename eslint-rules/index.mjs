import {
  disableEnablePair,
  noAggregatingEnable,
  noUnlimitedDisable,
  noUnusedEnable,
  requireDescription,
} from "./directive-comments.mjs";
import rule from "./no-non-document-comments.mjs";

/**
 * This repo's local lint plugin, registered under the `local` namespace
 * (e.g. `local/no-non-doc-comments`) in `eslint.config.mjs` and as an
 * Oxlint JS plugin. The directive-comment rules are Oxlint's replacements
 * for the `@eslint-community/eslint-comments` rules that misreport there
 * (oxc#23330); ESLint keeps running the originals.
 */
const localPlugin = {
  meta: { name: "local" },
  rules: {
    "no-non-doc-comments": rule,
    "require-description": requireDescription,
    "no-unlimited-disable": noUnlimitedDisable,
    "no-unused-enable": noUnusedEnable,
    "no-aggregating-enable": noAggregatingEnable,
    "disable-enable-pair": disableEnablePair,
  },
};

export default localPlugin;
