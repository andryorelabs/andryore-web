import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

interface ClaudeSettings {
  permissions: { allow: string[]; deny: string[] };
}

const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8")) as ClaudeSettings;

describe(".claude/settings.json deny list", () => {
  it.each([
    "Bash(git push * main)",
    "Bash(git push * develop)",
    "Bash(git push --force *)",
    "Bash(git push -f *)",
    "Bash(git push * --force)",
    "Bash(git push * -f)",
    "Bash(git push --force-with-lease *)",
    "Bash(git push * --force-with-lease)",
    "Bash(git push * --force *)",
    "Bash(git push * -f *)",
    "Bash(git push * --force-with-lease *)",
    "Bash(git push --force-with-lease=*)",
    "Bash(git push * --force-with-lease=*)",
    "Bash(git push * *:main)",
    "Bash(git push * *:develop)",
  ])("denies %s", (rule) => {
    expect(settings.permissions.deny).toContain(rule);
  });

  it("never allows a git push", () => {
    expect(settings.permissions.allow.filter((rule) => rule.startsWith("Bash(git push"))).toEqual(
      [],
    );
  });
});
