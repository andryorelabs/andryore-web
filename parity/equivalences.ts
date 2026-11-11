import type { Finding } from "./diff";

/**
 * ESLint rules that Oxlint cannot run but whose findings other Oxlint rules
 * report on the same line, keyed by ESLint rule id.
 *
 * `unicorn/no-useless-template-literals` needs type information, which
 * Oxlint JS plugins do not receive, and Oxlint has no native port. Every
 * line it flags is also flagged by one of the listed type-aware rules.
 */
export const EQUIVALENCES: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "unicorn/no-useless-template-literals",
    ["@typescript-eslint/no-base-to-string", "@typescript-eslint/restrict-template-expressions"],
  ],
]);

interface CoveredFinding extends Finding {
  coveredBy: string;
}

export interface EquivalenceResult {
  covered: CoveredFinding[];
  remaining: Finding[];
}

/**
 * Splits ESLint-only findings into those covered by an equivalent Oxlint
 * finding and those left. A finding is covered only when Oxlint reports one
 * of the rules listed for its rule in `EQUIVALENCES` on the same file and
 * line; a missing covering finding leaves it in `remaining`.
 * @param eslintOnly - Findings only ESLint reported.
 * @param oxlintFindings - Every finding Oxlint reported, in ESLint rule ids.
 * @param equivalences - ESLint rule id to covering Oxlint rule ids.
 * @returns The covered findings (with the covering rule) and the rest.
 */
export function resolveEquivalences(
  eslintOnly: readonly Finding[],
  oxlintFindings: readonly Finding[],
  equivalences: ReadonlyMap<string, readonly string[]> = EQUIVALENCES,
): EquivalenceResult {
  const covered: CoveredFinding[] = [];
  const remaining: Finding[] = [];
  for (const finding of eslintOnly) {
    const coveringRules = equivalences.get(finding.rule) ?? [];
    const cover = oxlintFindings.find(
      (candidate) =>
        candidate.file === finding.file &&
        candidate.line === finding.line &&
        coveringRules.includes(candidate.rule),
    );
    if (cover) covered.push({ ...finding, coveredBy: cover.rule });
    else remaining.push(finding);
  }
  return { covered, remaining };
}
