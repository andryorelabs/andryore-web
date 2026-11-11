import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const developmentDocument = readFileSync(path.join(import.meta.dir, "development.md"), "utf8");
const normalizedDocument = developmentDocument.replaceAll(/\s+/g, " ");

describe("promotion docs", () => {
  it("documents the merge commit promotion", () => {
    expect(normalizedDocument).toContain("merge commit");
    expect(normalizedDocument).toContain("gh pr merge --merge");
  });

  it("documents the promotion title", () => {
    expect(normalizedDocument).toContain("chore: 🔀 promote develop to main");
  });

  it("states that no sync step exists", () => {
    expect(normalizedDocument).toContain("No sync step exists");
  });

  it("never says a promotion is squash-merged", () => {
    const squashedPromotion =
      /promotion[^.]{0,80}squash[- ]merge|squash[- ]merge[^.]{0,80}promotion/i;
    expect(squashedPromotion.test(normalizedDocument)).toBe(false);
  });
});
