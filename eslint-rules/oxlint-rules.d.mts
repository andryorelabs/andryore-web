import type { DummyRuleMap, OxlintConfig, OxlintOverride } from "oxlint";

/**
 * Type declarations for `./oxlint-rules.mjs`, imported from
 * `oxlint.config.ts` and `oxlint-rules.test.ts`.
 */
type EslintRules = Record<string, unknown>;

export declare const OXLINT_JS_PLUGINS: NonNullable<OxlintConfig["jsPlugins"]>;
export declare const OXLINT_NATIVE_PLUGINS: NonNullable<OxlintConfig["plugins"]>;
export declare const NATIVE_PORTS: ReadonlyMap<string, string>;
export declare function toOxlintRuleId(ruleId: string): string;
export declare const ESLINT_PATH_BLOCKS: readonly {
  files: string[];
  rules: EslintRules;
}[];
export declare const OXLINT_BASE_RULES: DummyRuleMap;
export declare const OXLINT_OVERRIDES: OxlintOverride[];
export declare const OXLINT_SETTINGS: NonNullable<OxlintConfig["settings"]>;
export declare const OXLINT_IGNORE_PATTERNS: string[];
