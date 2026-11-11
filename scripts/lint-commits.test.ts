import { describe, expect, mock, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  buildCommitlintCommand,
  resolveCommitlintBase,
  runLintCommits,
  type GitResult,
  type GitRunner,
} from "./lint-commits";

function readCommitlintRunCommand(): string {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const match = /run: (bunx commitlint .+)/.exec(workflow);
  if (match?.[1] === undefined) {
    throw new Error("ci.yml has no commitlint run step.");
  }
  return match[1].trim();
}

describe("buildCommitlintCommand", () => {
  test("uses the same invocation and flags as the ci.yml commitlint job", () => {
    const workflowCommand = readCommitlintRunCommand()
      .replace('"$BASE_SHA"', "BASE")
      .replace('"$HEAD_SHA"', "HEAD");
    expect(buildCommitlintCommand("BASE", "HEAD").join(" ")).toBe(workflowCommand);
  });
});

function createGitRunner(responses: Record<string, GitResult>): {
  git: GitRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const git: GitRunner = (arguments_) => {
    calls.push(arguments_);
    return responses[arguments_.join(" ")] ?? { ok: false, output: "nope" };
  };
  return { git, calls };
}

describe("resolveCommitlintBase", () => {
  test("prefers origin/main", () => {
    const { git, calls } = createGitRunner({
      "merge-base origin/main HEAD": { ok: true, output: "aaa" },
      "merge-base main HEAD": { ok: true, output: "bbb" },
    });
    expect(resolveCommitlintBase(git)).toBe("aaa");
    expect(calls).toEqual([["merge-base", "origin/main", "HEAD"]]);
  });

  test("falls back to main when origin/main is missing", () => {
    const { git, calls } = createGitRunner({
      "merge-base main HEAD": { ok: true, output: "bbb" },
    });
    expect(resolveCommitlintBase(git)).toBe("bbb");
    expect(calls.map((call) => call[1])).toEqual(["origin/main", "main"]);
  });

  test("throws when neither ref resolves", () => {
    const { git } = createGitRunner({});
    expect(() => resolveCommitlintBase(git)).toThrow(/could not resolve a merge-base/);
  });
});

describe("runLintCommits", () => {
  test("spawns commitlint between the merge-base and HEAD", async () => {
    const { git } = createGitRunner({
      "merge-base origin/main HEAD": { ok: true, output: "base" },
      "rev-parse HEAD": { ok: true, output: "head" },
    });
    const spawnCommand = mock(() => Promise.resolve(3));
    expect(await runLintCommits({ git, spawnCommand })).toBe(3);
    expect(spawnCommand).toHaveBeenCalledWith("bunx", [
      "commitlint",
      "--from",
      "base",
      "--to",
      "HEAD",
      "--verbose",
    ]);
  });

  test("skips linting when HEAD is the merge-base", async () => {
    const { git } = createGitRunner({
      "merge-base origin/main HEAD": { ok: true, output: "same" },
      "rev-parse HEAD": { ok: true, output: "same" },
    });
    const spawnCommand = mock(() => Promise.resolve(0));
    const log = spyOn(console, "log").mockImplementation((): void => {
      return;
    });
    expect(await runLintCommits({ git, spawnCommand })).toBe(0);
    expect(spawnCommand).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("nothing to lint"));
    log.mockRestore();
  });

  test("throws when HEAD cannot be resolved", async () => {
    const { git } = createGitRunner({
      "merge-base origin/main HEAD": { ok: true, output: "base" },
    });
    const spawnCommand = mock(() => Promise.resolve(0));
    let message = "";
    try {
      await runLintCommits({ git, spawnCommand });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/could not resolve HEAD/);
  });
});
