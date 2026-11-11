import path from "node:path";

/**
 * One lint finding, identified by `(file, line, rule)` in ESLint rule ids.
 */
export interface Finding {
  file: string;
  line: number;
  rule: string;
}

/**
 * A documented, explained gap. Omitting `line` accepts every line of that
 * `(file, rule)`; `reason` is mandatory and must not be blank.
 */
export interface AcceptedEntry {
  file: string;
  line?: number;
  rule: string;
  reason: string;
}

export interface FindingsDiff {
  common: Finding[];
  eslintOnly: Finding[];
  oxlintOnly: Finding[];
}

export interface GateResult {
  unexplained: Finding[];
  explained: (Finding & { reason: string })[];
  stale: AcceptedEntry[];
  exitCode: 0 | 1;
}

export const findingKey = (finding: Finding): string =>
  `${finding.file}:${String(finding.line)}:${finding.rule}`;

const compareFindings = (left: Finding, right: Finding): number =>
  left.file.localeCompare(right.file) ||
  left.line - right.line ||
  left.rule.localeCompare(right.rule);

function uniqueSorted(findings: readonly Finding[]): Finding[] {
  const byKey = new Map(findings.map((item) => [findingKey(item), item]));
  return byKey.values().toArray().toSorted(compareFindings);
}

/**
 * Pseudo rule id for "unused disable directive" reports: ESLint emits them
 * without a rule id, Oxlint with an empty code, and both are enforced
 * (`reportUnusedDisableDirectives`).
 */
export const UNUSED_DIRECTIVE_RULE = "unused-disable-directive";

/**
 * Rules whose findings match by file, rule and count instead of line.
 *
 * Both engines report an unused disable directive, but anchor it differently:
 * ESLint at the directive, Oxlint at the closing `eslint-enable`. The finding
 * is the same and the position is not configurable, so the line is ignored
 * and only the per-file count has to agree.
 */
const POSITION_INSENSITIVE_RULES: ReadonlySet<string> = new Set([UNUSED_DIRECTIVE_RULE]);

const isPositionInsensitive = (finding: Finding): boolean =>
  POSITION_INSENSITIVE_RULES.has(finding.rule);

const fileRuleKey = (finding: Finding): string => `${finding.file}\0${finding.rule}`;

function groupByFileRule(findings: readonly Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const item of findings.toSorted(compareFindings)) {
    const group = groups.get(fileRuleKey(item)) ?? [];
    group.push(item);
    groups.set(fileRuleKey(item), group);
  }
  return groups;
}

function diffPositionInsensitive(
  eslint: readonly Finding[],
  oxlint: readonly Finding[],
): FindingsDiff {
  const eslintGroups = groupByFileRule(eslint);
  const oxlintGroups = groupByFileRule(oxlint);
  const keys = new Set([...eslintGroups.keys(), ...oxlintGroups.keys()]);
  const diff: FindingsDiff = { common: [], eslintOnly: [], oxlintOnly: [] };
  for (const key of keys) {
    const eslintGroup = eslintGroups.get(key) ?? [];
    const oxlintGroup = oxlintGroups.get(key) ?? [];
    const paired = Math.min(eslintGroup.length, oxlintGroup.length);
    diff.common.push(...eslintGroup.slice(0, paired));
    diff.eslintOnly.push(...eslintGroup.slice(paired));
    diff.oxlintOnly.push(...oxlintGroup.slice(paired));
  }
  return diff;
}

/**
 * Splits two finding sets by `(file, line, rule)` identity, except for the
 * `POSITION_INSENSITIVE_RULES`, which match by `(file, rule)` and count.
 * Duplicates of line-sensitive findings collapse and every list comes back
 * sorted, so output is deterministic.
 * @param eslint - Findings reported by ESLint.
 * @param oxlint - Findings reported by Oxlint, in ESLint rule ids.
 * @returns The findings split into common, ESLint-only and Oxlint-only.
 */
export function diffFindings(eslint: readonly Finding[], oxlint: readonly Finding[]): FindingsDiff {
  const eslintUnique = uniqueSorted(eslint.filter((item) => !isPositionInsensitive(item)));
  const oxlintUnique = uniqueSorted(oxlint.filter((item) => !isPositionInsensitive(item)));
  const eslintKeys = new Set(eslintUnique.map((item) => findingKey(item)));
  const oxlintKeys = new Set(oxlintUnique.map((item) => findingKey(item)));
  const loose = diffPositionInsensitive(
    eslint.filter((item) => isPositionInsensitive(item)),
    oxlint.filter((item) => isPositionInsensitive(item)),
  );
  const merge = (strict: Finding[], extra: Finding[]): Finding[] =>
    [...strict, ...extra].toSorted(compareFindings);
  return {
    common: merge(
      eslintUnique.filter((item) => oxlintKeys.has(findingKey(item))),
      loose.common,
    ),
    eslintOnly: merge(
      eslintUnique.filter((item) => !oxlintKeys.has(findingKey(item))),
      loose.eslintOnly,
    ),
    oxlintOnly: merge(
      oxlintUnique.filter((item) => !eslintKeys.has(findingKey(item))),
      loose.oxlintOnly,
    ),
  };
}

/**
 * Parses an `accepted.json` document. Throws on a non-array, a malformed
 * entry, or an entry whose `reason` is missing or blank: a gap is never
 * accepted without an explanation.
 * @param text - The raw `accepted.json` content.
 * @returns The validated entries.
 */
export function parseAccepted(text: string): AcceptedEntry[] {
  const document: unknown = JSON.parse(text);
  if (!Array.isArray(document)) {
    throw new TypeError("accepted.json must be a JSON array");
  }
  return (document as unknown[]).map((raw, index) => {
    const entry = raw as Partial<AcceptedEntry> | null;
    const label = `accepted.json entry ${String(index)}`;
    if (typeof entry?.file !== "string" || typeof entry.rule !== "string") {
      throw new TypeError(`${label} needs string "file" and "rule"`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      throw new TypeError(`${label} needs a non-empty "reason"`);
    }
    if (entry.line !== undefined && typeof entry.line !== "number") {
      throw new TypeError(`${label} "line" must be a number`);
    }
    return {
      file: entry.file,
      ...(entry.line !== undefined && { line: entry.line }),
      rule: entry.rule,
      reason: entry.reason,
    };
  });
}

const isCoveredBy = (entry: AcceptedEntry, finding: Finding): boolean =>
  entry.file === finding.file &&
  entry.rule === finding.rule &&
  (entry.line === undefined || entry.line === finding.line);

/**
 * Applies the accepted gaps to the ESLint-only findings. Anything left
 * unexplained fails the gate (exit code 1); accepted entries that matched
 * nothing are reported as stale so the list cannot rot silently.
 * @param eslintOnly - Findings only ESLint reported.
 * @param accepted - The explained gaps.
 * @returns The explained and unexplained findings, stale entries and exit code.
 */
export function resolveGate(
  eslintOnly: readonly Finding[],
  accepted: readonly AcceptedEntry[],
): GateResult {
  const unexplained: Finding[] = [];
  const explained: GateResult["explained"] = [];
  const used = new Set<AcceptedEntry>();
  for (const finding of eslintOnly) {
    const match = accepted.find((entry) => isCoveredBy(entry, finding));
    if (match) {
      used.add(match);
      explained.push({ ...finding, reason: match.reason });
    } else {
      unexplained.push(finding);
    }
  }
  return {
    unexplained,
    explained,
    stale: accepted.filter((entry) => !used.has(entry)),
    exitCode: unexplained.length > 0 ? 1 : 0,
  };
}

const OXLINT_PLUGIN_PREFIX: Record<string, string> = {
  eslint: "",
  "eslint-js": "",
  typescript: "@typescript-eslint/",
  "typescript-eslint": "@typescript-eslint/",
  nextjs: "@next/next/",
  next: "@next/next/",
  "typescript-js": "@typescript-eslint/",
  "unicorn-js": "unicorn/",
  "jsdoc-js": "jsdoc/",
  "jsx-a11y-js": "jsx-a11y/",
  "astro-js": "astro/",
  "react-hooks-js": "react-hooks/",
  "eslint-comments-js": "@eslint-community/eslint-comments/",
};

/**
 * `@eslint-community/eslint-comments` rules that run under Oxlint as the
 * `local/` ports in `eslint-rules/directive-comments.mjs`.
 */
const LOCAL_DIRECTIVE_RULES = new Set([
  "disable-enable-pair",
  "no-aggregating-enable",
  "no-unlimited-disable",
  "no-unused-enable",
  "require-description",
]);

/**
 * Maps an Oxlint diagnostic `code` (`plugin(rule)`) to the ESLint rule id the
 * same rule has under the current config: native plugins, the `-js` jsPlugin
 * aliases `oxlint.config.ts` loads the originals under, and the `local/`
 * ports of the eslint-comments directive rules. Unknown plugins map to
 * `plugin/rule`, which is how every other plugin names its rules.
 * @param code - The Oxlint diagnostic code, such as `eslint(no-console)`.
 * @returns The ESLint rule id.
 */
export function normalizeOxlintRule(code: string): string {
  const match = /^([^()]+)\((.+)\)$/.exec(code);
  if (!match) return code;
  const [, plugin = "", rule = ""] = match;
  const isDirectivePort = plugin === "local" && LOCAL_DIRECTIVE_RULES.has(rule);
  const prefix = isDirectivePort
    ? "@eslint-community/eslint-comments/"
    : (OXLINT_PLUGIN_PREFIX[plugin] ?? `${plugin}/`);
  return `${prefix}${rule}`;
}

const UNUSED_DIRECTIVE_MESSAGE = /^Unused (?:eslint|oxlint)-(?:disable|enable) directive/;

/**
 * Pseudo rule id for an Oxlint diagnostic that carries no `code` and is not
 * an unused-directive report, so it still shows up in the diff.
 */
export const OXLINT_UNCODED_RULE = "oxlint-uncoded-diagnostic";

const oxlintRuleOf = (code: string, message: string): string => {
  if (code !== "") return normalizeOxlintRule(code);
  return UNUSED_DIRECTIVE_MESSAGE.test(message) ? UNUSED_DIRECTIVE_RULE : OXLINT_UNCODED_RULE;
};

const UNKNOWN_RULE_MESSAGE = /^Definition for rule '.+' was not found\.?$/;

/**
 * A directive that names an unknown rule suppresses nothing: ESLint reports
 * it under that rule id ("Definition for rule ... was not found"), Oxlint as
 * an unused directive, so both land on the unused-directive pseudo rule.
 * @param ruleId - The ESLint message's rule id.
 * @param message - The ESLint message text.
 * @returns The rule id, or undefined for a message that is not a finding.
 */
const eslintRuleOf = (ruleId: string | null, message: string): string | undefined => {
  if (UNKNOWN_RULE_MESSAGE.test(message)) return UNUSED_DIRECTIVE_RULE;
  if (ruleId !== null) return ruleId;
  return UNUSED_DIRECTIVE_MESSAGE.test(message) ? UNUSED_DIRECTIVE_RULE : undefined;
};

/**
 * Rewrites Oxlint findings of a native port whose Oxlint id normalizes to a
 * different ESLint id (such as the core `no-unused-expressions` port that
 * enforces `@typescript-eslint/no-unused-expressions`) to that ESLint id.
 * @param findings - Oxlint findings, already in normalized rule ids.
 * @param nativePorts - ESLint rule id to native Oxlint rule id, as in
 *   `NATIVE_PORTS` of `eslint-rules/oxlint-rules.mjs`.
 * @returns The findings with every port under its ESLint id.
 */
export function remapNativePorts(
  findings: readonly Finding[],
  nativePorts: ReadonlyMap<string, string>,
): Finding[] {
  const eslintIdByNormalizedNative = new Map(
    [...nativePorts]
      .map(([eslintId, nativeId]) => [normalizeOxlintRule(nativeCode(nativeId)), eslintId] as const)
      .filter(([normalized, eslintId]) => normalized !== eslintId),
  );
  return findings.map((item) => {
    const eslintId = eslintIdByNormalizedNative.get(item.rule);
    return eslintId === undefined ? item : { ...item, rule: eslintId };
  });
}

const nativeCode = (nativeId: string): string => {
  const slash = nativeId.indexOf("/");
  return slash === -1
    ? `eslint(${nativeId})`
    : `${nativeId.slice(0, slash)}(${nativeId.slice(slash + 1)})`;
};

interface EslintResult {
  filePath: string;
  messages: {
    ruleId: string | null;
    line: number;
    message?: string;
    fatal?: boolean;
  }[];
}

/**
 * Reads `eslint --format json` output. Fatal messages (parse errors) throw so
 * a file ESLint could not analyse never silently drops out of the comparison;
 * other messages without a rule id are skipped. Paths become repo-relative.
 * @param text - The raw `eslint --format json` output.
 * @param root - The repository root that paths become relative to.
 * @returns The findings, one per reported rule.
 */
export function parseEslintJson(text: string, root: string): Finding[] {
  const results = JSON.parse(text) as EslintResult[];
  const fatal = results.flatMap((result) =>
    result.messages
      .filter((message) => message.fatal === true)
      .map((message) => `${result.filePath}: ${message.message ?? "fatal"}`),
  );
  if (fatal.length > 0) {
    throw new Error(`ESLint reported fatal errors:\n${fatal.join("\n")}`);
  }
  return results.flatMap((result) =>
    result.messages.flatMap((message) => {
      const rule = eslintRuleOf(message.ruleId, message.message ?? "");
      return rule === undefined
        ? []
        : {
            file: path.relative(root, result.filePath),
            line: message.line,
            rule,
          };
    }),
  );
}

interface OxlintOutput {
  diagnostics: {
    code?: string;
    message?: string;
    filename: string;
    labels?: { span: { line: number } }[];
  }[];
}

/**
 * Reads `oxlint --format json` output. A diagnostic without a label has no
 * location and is kept at line 0 so it still shows up in the diff.
 * @param text - The raw `oxlint --format json` output.
 * @param root - The repository root that paths become relative to.
 * @returns The findings, one per diagnostic.
 */
export function parseOxlintJson(text: string, root: string): Finding[] {
  const output = JSON.parse(text) as OxlintOutput;
  return output.diagnostics.map((diagnostic) => ({
    file: path.isAbsolute(diagnostic.filename)
      ? path.relative(root, diagnostic.filename)
      : diagnostic.filename,
    line: diagnostic.labels?.[0]?.span.line ?? 0,
    rule: oxlintRuleOf(diagnostic.code ?? "", diagnostic.message ?? ""),
  }));
}
