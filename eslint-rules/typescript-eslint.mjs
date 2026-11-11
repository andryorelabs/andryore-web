import tseslint from "typescript-eslint";

/**
 * typescript-eslint's ESLint plugin as a default export, the shape Oxlint's
 * `jsPlugins` loads. The `typescript-eslint` package exports it as a named
 * `plugin`, so Oxlint loads this module under the `typescript-js` alias to
 * run the original rules that have no proven native port.
 */
const typescriptEslintPlugin = tseslint.plugin;

export default typescriptEslintPlugin;
