import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolveCommitlintBase, runLintCommits } from "./lint-commits.ts";

function writeExecutable(file: string, body: string): void {
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
}

async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the promise to reject");
}

describe("default dependencies", () => {
  const originalPath = process.env.PATH;
  let root: string;
  let binDirectory: string;

  function stubGit(): void {
    writeExecutable(
      path.join(binDirectory, "git"),
      [
        'case "$1" in',
        '  merge-base) echo " base " ;;',
        "  rev-parse) echo head ;;",
        "  *) exit 2 ;;",
        "esac",
      ].join("\n"),
    );
  }

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "lint-commits-defaults-"));
    binDirectory = path.join(root, "bin");
    mkdirSync(binDirectory);
    process.env.PATH = binDirectory;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    rmSync(root, { recursive: true, force: true });
  });

  test("runs the real git runner and trims its output", () => {
    stubGit();

    expect(resolveCommitlintBase()).toBe("base");
  });

  test("propagates the commitlint exit code from the spawned process", async () => {
    stubGit();
    const argumentsFile = path.join(root, "arguments.txt");
    writeExecutable(path.join(binDirectory, "bunx"), `echo "$@" > '${argumentsFile}'\nexit 5`);

    const code = await runLintCommits();

    expect(code).toBe(5);
    expect(readFileSync(argumentsFile, "utf8").trim()).toBe(
      "commitlint --from base --to HEAD --verbose",
    );
  });

  test("maps a signal exit to code 1", async () => {
    stubGit();
    writeExecutable(path.join(binDirectory, "bunx"), "kill -KILL $$");

    const code = await runLintCommits();

    expect(code).toBe(1);
  });

  test("rejects when the process fails to spawn", async () => {
    stubGit();

    const message = await rejectionMessage(runLintCommits());

    expect(message).toMatch(/ENOENT|not found/);
  });
});
