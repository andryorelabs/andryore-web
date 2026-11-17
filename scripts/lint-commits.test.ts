import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildCommitlintCommand,
  resolveCommitlintBase,
  runLintCommits,
  type GitResult,
  type GitRunner,
} from "./lint-commits";
import { readWorkflow } from "./workflow-files";

describe("buildCommitlintCommand", () => {
  test("lints the range verbosely with the local commitlint", () => {
    expect(buildCommitlintCommand("BASE", "HEAD")).toEqual([
      "bunx",
      "commitlint",
      "--from",
      "BASE",
      "--to",
      "HEAD",
      "--verbose",
    ]);
  });

  test("is what the ci.yml commitlint job runs, through bun run lint:commits", () => {
    const runs = (readWorkflow("ci.yml").jobs?.commitlint?.steps ?? []).map((step) => step.run);
    expect(runs).toContain("bun run lint:commits");
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

function git(directory: string, ...arguments_: string[]): void {
  const result = spawnSync("git", arguments_, {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
    },
  });
  expect(result.status).toBe(0);
}

describe("entry point", () => {
  const originalDirectory = process.cwd();
  const originalArgument = process.argv[1];
  const originalPath = process.env.PATH;
  const originalExitCode = process.exitCode;
  const directories: string[] = [];
  let importCounter = 0;

  afterEach(() => {
    process.chdir(originalDirectory);
    process.argv[1] = originalArgument ?? "";
    process.env.PATH = originalPath;
    process.exitCode = originalExitCode ?? 0;
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function makeDirectory(): string {
    const directory = mkdtempSync(path.join(tmpdir(), "lint-commits-entry-"));
    directories.push(directory);
    return directory;
  }

  function makeRepository(): string {
    const directory = makeDirectory();
    git(directory, "init", "-q", "-b", "main");
    git(directory, "commit", "-q", "--allow-empty", "-m", "base");
    return directory;
  }

  async function runEntry(directory: string): Promise<number | string | undefined> {
    process.chdir(directory);
    const modulePath = path.join(originalDirectory, "scripts", "lint-commits.ts");
    process.argv[1] = modulePath;
    process.exitCode = undefined;
    importCounter += 1;
    await import(`${modulePath}?entry=${String(importCounter)}`);
    return process.exitCode;
  }

  function stubBunx(exitCode: number): void {
    const directory = makeDirectory();
    const stub = path.join(directory, "bunx");
    writeFileSync(stub, `#!/bin/sh\nexit ${String(exitCode)}\n`);
    chmodSync(stub, 0o755);
    process.env.PATH = `${directory}:${originalPath ?? ""}`;
  }

  test("exits 0 when HEAD is the merge-base", async () => {
    const log = spyOn(console, "log").mockImplementation((): void => undefined);
    expect(await runEntry(makeRepository())).toBe(0);
    log.mockRestore();
  });

  test("returns the exit code of the spawned commitlint", async () => {
    const repository = makeRepository();
    git(repository, "checkout", "-q", "-b", "feature");
    git(repository, "commit", "-q", "--allow-empty", "-m", "feat: add thing");
    stubBunx(3);
    expect(await runEntry(repository)).toBe(3);
  });

  test("reports an error and exits 1 outside a repository", async () => {
    const error = spyOn(console, "error").mockImplementation((): void => undefined);
    expect(await runEntry(makeDirectory())).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("merge-base"));
    error.mockRestore();
  });
});
