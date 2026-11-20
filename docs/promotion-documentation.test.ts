import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const developmentDocument = readFileSync(path.join(import.meta.dir, "development.md"), "utf8");
const normalizedDocument = developmentDocument.replaceAll(/\s+/g, " ");

describe("promotion docs", () => {
  it("documents the merge commit promotion opened by emet promote", () => {
    expect(normalizedDocument).toContain("merge commit");
    expect(normalizedDocument).toContain("emet promote");
    expect(normalizedDocument).toContain("ADR 0028");
  });

  it("documents the promotion title", () => {
    expect(normalizedDocument).toContain("chore: 🔖 promote develop");
    expect(normalizedDocument).not.toContain("chore: 🔀 promote develop to main");
  });

  it("documents the sync pull request and its manual merge", () => {
    expect(normalizedDocument).toContain("chore: 🔖 sync main into develop");
    expect(normalizedDocument).toContain("gh pr merge <n> --merge --auto");
  });

  it("no longer states that no sync step exists or that develop is linear", () => {
    expect(normalizedDocument).not.toContain("No sync step exists");
    expect(normalizedDocument).not.toContain("develop` keeps a linear history");
  });

  it("never says a promotion is squash-merged", () => {
    const squashedPromotion =
      /promotion[^.]{0,80}squash[- ]merge|squash[- ]merge[^.]{0,80}promotion/i;
    expect(squashedPromotion.test(normalizedDocument)).toBe(false);
  });
});
