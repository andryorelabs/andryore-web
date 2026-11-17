const ZERO_SHA = "0".repeat(40);
const PROTECTED_BRANCHES = new Set(["main", "develop"]);
const VALID_BRANCH =
  /^(renovate\/.+|worktree-.+|ao-\d+-[a-z0-9._-]+|(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\/[a-z0-9._-]+)$/;

/**
 * Outcome of a hook check: either it passes, or it fails with a message for the
 * developer.
 */
export type Result = { ok: true } | { ok: false; message: string };

/**
 * Runs the project typecheck and reports whether it passed.
 */
export type TypecheckRunner = () => boolean;

/**
 * Runs `bun run typecheck` with inherited output.
 * @returns True when the typecheck exits with code 0.
 */
export function isTypecheckPassing(): boolean {
  const completed = Bun.spawnSync(["bun", "run", "typecheck"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  return completed.exitCode === 0;
}

/**
 * Validates a single branch name that is about to be pushed.
 * @param branch - The remote branch name, without the `refs/heads/` prefix.
 * @returns A failing result when the branch is protected or badly named.
 */
export function checkBranch(branch: string): Result {
  if (PROTECTED_BRANCHES.has(branch)) {
    return {
      ok: false,
      message: `Direct pushes to ${branch} are refused; push a feature branch and open a pull request`,
    };
  }
  if (!VALID_BRANCH.test(branch)) {
    return {
      ok: false,
      message: [
        `Invalid branch name: ${branch}`,
        "Expected: <type>/<kebab-slug>, ao-<n>-<slug>, worktree-* or renovate/*   e.g. feat/add-export",
        "Types: feat fix docs style refactor perf test build ci chore revert",
      ].join("\n"),
    };
  }
  return { ok: true };
}

/**
 * Checks the ref lines git feeds to a pre-push hook: refuses protected and
 * badly named branches, then runs the typecheck when a branch is pushed.
 * Deletions and non-branch refs are skipped.
 * @param lines - The stdin lines, each `<local ref> <local sha> <remote ref> <remote sha>`.
 * @param isTypecheckClean - The typecheck runner, injectable for tests.
 * @returns A failing result with the reason, or an ok result.
 */
export function checkPush(
  lines: string[],
  isTypecheckClean: TypecheckRunner = isTypecheckPassing,
): Result {
  let isPushesBranch = false;
  for (const line of lines) {
    const [, localSha, remoteRef] = line.trim().split(/\s+/, 3);
    if (
      localSha === undefined ||
      remoteRef === undefined ||
      localSha === ZERO_SHA ||
      !remoteRef.startsWith("refs/heads/")
    ) {
      continue;
    }
    const verdict = checkBranch(remoteRef.slice("refs/heads/".length));
    if (!verdict.ok) {
      return verdict;
    }
    isPushesBranch = true;
  }
  if (isPushesBranch && !isTypecheckClean()) {
    return {
      ok: false,
      message: "pre-push: typecheck failed; fix the type errors above before pushing",
    };
  }
  return { ok: true };
}

/**
 * Hook entry point: reads the ref lines from stdin and prints a failure.
 * @returns The process exit code.
 */
export async function main(): Promise<number> {
  const input = await Bun.stdin.text();
  const verdict = checkPush(input.split("\n").filter((line) => line.trim() !== ""));
  if (verdict.ok) {
    return 0;
  }
  console.error(`\n${verdict.message}\n`);
  return 1;
}

if (import.meta.main) process.exitCode = await main();
