import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { checkBranch, checkPush } from "./pre-push";

const SHA = "a".repeat(40);
const ZERO = "0".repeat(40);

async function exitCodeOf(stdin: string): Promise<number> {
  const child = Bun.spawn(["bun", "scripts/hooks/pre-push.ts"], {
    stdin: new TextEncoder().encode(stdin),
    stdout: "ignore",
    stderr: "ignore",
  });
  return child.exited;
}

function pushLine(branch: string): string {
  return `refs/heads/${branch} ${SHA} refs/heads/${branch} ${ZERO}`;
}

describe("checkPush", () => {
  it.each(["main", "develop"])("refuses a direct push to %s", (branch) => {
    const verdict = checkPush([pushLine(branch)], () => true);
    expect(verdict.ok).toBe(false);
  });

  it.each([
    "ao-3181-ts-hooks",
    "worktree-agent-a85d8ae8afd7552d4",
    "renovate/lock-file-maintenance",
    "feat/add-export",
    "chore/tidy-hooks",
  ])("allows %s and runs the typecheck", (branch) => {
    let typecheckRuns = 0;
    const verdict = checkPush([pushLine(branch)], () => {
      typecheckRuns += 1;
      return true;
    });
    expect(verdict).toEqual({ ok: true });
    expect(typecheckRuns).toBe(1);
  });

  it.each(["Feature", "wip", "feat/Bad_Name", "ao-x-slug"])("rejects the name %s", (branch) => {
    const verdict = checkPush([pushLine(branch)], () => true);
    expect(verdict.ok).toBe(false);
  });

  it("fails when the typecheck fails", () => {
    const verdict = checkPush([pushLine("feat/add-export")], () => false);
    expect(verdict).toEqual({
      ok: false,
      message: "pre-push: typecheck failed; fix the type errors above before pushing",
    });
  });

  it("skips deletions, tags and blank input without typechecking", () => {
    const lines = [
      `refs/heads/main ${ZERO} refs/heads/main ${SHA}`,
      `refs/tags/v1 ${SHA} refs/tags/v1 ${ZERO}`,
      "",
      "incomplete",
    ];
    const verdict = checkPush(lines, () => {
      throw new Error("typecheck must not run");
    });
    expect(verdict).toEqual({ ok: true });
  });

  it("refuses main even when another valid branch is pushed with it", () => {
    const verdict = checkPush([pushLine("feat/add-export"), pushLine("main")], () => true);
    expect(verdict.ok).toBe(false);
  });
});

describe("checkBranch", () => {
  it("names the protected branch in the message", () => {
    const verdict = checkBranch("develop");
    expect(verdict).toEqual({
      ok: false,
      message:
        "Direct pushes to develop are refused; push a feature branch and open a pull request",
    });
  });
});

describe("hook files", () => {
  it("husky pre-push only calls the TS entry point", () => {
    expect(readFileSync(".husky/pre-push", "utf8").trim()).toBe("bun scripts/hooks/pre-push.ts");
  });
});

describe("hook entry point", () => {
  it("exits 1 on a push to main", async () => {
    expect(await exitCodeOf(`${pushLine("main")}\n`)).toBe(1);
  });

  it("exits 0 when there is nothing to check", async () => {
    expect(await exitCodeOf("")).toBe(0);
  });
});
