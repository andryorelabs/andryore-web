import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { buildCommitlintCommand } from "./commit-message";

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
});
