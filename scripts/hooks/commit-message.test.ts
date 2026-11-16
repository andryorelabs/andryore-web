import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { buildCommitlintCommand, main, runCommand } from "./commit-message";

describe("commit-msg hook", () => {
  it("husky commit-msg only calls the TS entry point", () => {
    expect(readFileSync(".husky/commit-msg", "utf8").trim()).toBe(
      'bun scripts/hooks/commit-message.ts "$1"',
    );
  });

  it("builds the commitlint command", () => {
    expect(buildCommitlintCommand(".git/COMMIT_EDITMSG")).toEqual([
      "bunx",
      "commitlint",
      "--edit",
      ".git/COMMIT_EDITMSG",
    ]);
  });

  it("exits 1 without a message file", async () => {
    const child = Bun.spawn(["bun", "scripts/hooks/commit-message.ts"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    expect(await child.exited).toBe(1);
  });

  it("passes the commitlint command to the runner and returns its exit code", () => {
    const calls: string[][] = [];
    const exitCode = main(".git/COMMIT_EDITMSG", (command) => {
      calls.push(command);
      return 7;
    });
    expect(exitCode).toBe(7);
    expect(calls).toEqual([["bunx", "commitlint", "--edit", ".git/COMMIT_EDITMSG"]]);
  });

  it("returns 1 without running anything when the message file is missing", () => {
    const calls: string[][] = [];
    const exitCode = main(undefined, (command) => {
      calls.push(command);
      return 0;
    });
    expect(exitCode).toBe(1);
    expect(calls).toEqual([]);
  });

  it("runs a command and returns its exit code", () => {
    expect(runCommand(["bun", "-e", "process.exit(3)"])).toBe(3);
  });
});
