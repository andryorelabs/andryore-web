import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dir, "..");

const LEGACY_OWNER_SLUG = ["AndryOre", "andryore-web"].join("/");
const LEGACY_NAME = ["for", "ge"].join("");
const LEGACY_NAME_PATTERN = new RegExp(LEGACY_NAME, "i");
const LEGACY_NAME_ALLOWED_PREFIXES: readonly string[] = ["docs/adr/", ".claude/skills/"];
const LEGACY_NAME_ALLOWED_FILES: ReadonlySet<string> = new Set(["CHANGELOG.md"]);
const SLOGAN_PATTERN = /^\*\*(.+)\*\*$/m;
const BRAND_SECTION_HEADING = "## Cross-repo brand rules";

function listTrackedFiles(): string[] {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return result.stdout
    .split("\0")
    .filter((filePath) => filePath !== "" && existsSync(path.join(repositoryRoot, filePath)));
}

function findHits(
  files: readonly string[],
  isMatch: (content: string) => boolean,
  isAllowed: (filePath: string) => boolean = () => false,
): string[] {
  return files.filter(
    (filePath) =>
      !isAllowed(filePath) && isMatch(readFileSync(path.join(repositoryRoot, filePath), "utf8")),
  );
}

function isLegacyNameAllowed(filePath: string): boolean {
  return (
    LEGACY_NAME_ALLOWED_FILES.has(filePath) ||
    LEGACY_NAME_ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  );
}

function extractSlogan(readme: string): string | undefined {
  return SLOGAN_PATTERN.exec(readme)?.[1];
}

function extractBrandPublicLines(brandReadme: string): {
  slogan?: string | undefined;
  description?: string | undefined;
} {
  const start = brandReadme.indexOf(BRAND_SECTION_HEADING);
  if (start === -1) return {};
  const section = brandReadme.slice(start);
  return {
    slogan: /^- Slogan: `(.+)`$/m.exec(section)?.[1],
    description: /^- Description: `(.+)`$/m.exec(section)?.[1],
  };
}

function documentsRequiringIndex(files: readonly string[]): string[] {
  return files.filter(
    (filePath) =>
      filePath.startsWith("docs/") &&
      filePath.endsWith(".md") &&
      filePath !== "docs/README.md" &&
      !/^docs\/adr\/\d{4}-/.test(filePath) &&
      !filePath.startsWith("docs/brand/brandbook/fonts/"),
  );
}

function unindexedDocuments(index: string, documents: readonly string[]): string[] {
  return documents.filter((filePath) => !index.includes(`(./${filePath.slice("docs/".length)})`));
}

function skillLockDrift(
  lockedNames: readonly string[],
  directoryNames: readonly string[],
): { missingFromLock: string[]; missingFromDisk: string[] } {
  return {
    missingFromLock: directoryNames.filter((name) => !lockedNames.includes(name)),
    missingFromDisk: lockedNames.filter((name) => !directoryNames.includes(name)),
  };
}

const trackedFiles = listTrackedFiles();

describe("owner slug", () => {
  test("no tracked file uses the legacy owner slug", () => {
    expect(findHits(trackedFiles, (content) => content.includes(LEGACY_OWNER_SLUG))).toEqual([]);
  });

  test("findHits reports a file that breaks the rule", () => {
    expect(findHits(["README.md"], () => true)).toEqual(["README.md"]);
  });
});

describe("legacy name", () => {
  test("no tracked file outside the allowlist contains the legacy name", () => {
    expect(
      findHits(trackedFiles, (content) => LEGACY_NAME_PATTERN.test(content), isLegacyNameAllowed),
    ).toEqual([]);
  });

  test("allows docs/adr/", () => {
    expect(isLegacyNameAllowed("docs/adr/0015-develop-as-integration-branch.md")).toBe(true);
  });

  test("allows CHANGELOG.md", () => {
    expect(isLegacyNameAllowed("CHANGELOG.md")).toBe(true);
  });

  test("allows .claude/skills", () => {
    expect(isLegacyNameAllowed(".claude/skills/ai-seo/SKILL.md")).toBe(true);
  });

  test("does not allow other paths", () => {
    expect(isLegacyNameAllowed("README.md")).toBe(false);
    expect(isLegacyNameAllowed("docs/development.md")).toBe(false);
    expect(isLegacyNameAllowed("src/CHANGELOG.md")).toBe(false);
    expect(isLegacyNameAllowed(".claude/settings.json")).toBe(false);
  });

  test("the pattern is case-insensitive", () => {
    expect(LEGACY_NAME_PATTERN.test(LEGACY_NAME.toUpperCase())).toBe(true);
    expect(LEGACY_NAME_PATTERN.test(`run ${LEGACY_NAME} init`)).toBe(true);
  });
});

describe("public lines", () => {
  const readme = readFileSync(path.join(repositoryRoot, "README.md"), "utf8");
  const brandReadme = readFileSync(path.join(repositoryRoot, "docs/brand/README.md"), "utf8");
  const packageDescription = (
    JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8")) as {
      description: string;
    }
  ).description;

  test("the README slogan, package description and brand section agree", () => {
    const brand = extractBrandPublicLines(brandReadme);
    const slogan = extractSlogan(readme);
    expect(slogan).toBeDefined();
    expect(brand.slogan).toBe(slogan);
    expect(brand.description).toBe(packageDescription);
    expect(slogan).toBe(packageDescription);
  });

  test("a drifted description is detected", () => {
    const brand = extractBrandPublicLines("## Cross-repo brand rules\n\n- Description: `Old`\n");
    expect(brand.description).not.toBe(packageDescription);
  });

  test("the brand section is absent when the heading is missing", () => {
    expect(extractBrandPublicLines("# Brand kit\n")).toEqual({});
  });
});

describe("docs index", () => {
  test("every tracked doc under docs/ is listed in docs/README.md", () => {
    const index = readFileSync(path.join(repositoryRoot, "docs/README.md"), "utf8");
    expect(unindexedDocuments(index, documentsRequiringIndex(trackedFiles))).toEqual([]);
  });

  test("an unindexed doc is detected", () => {
    expect(unindexedDocuments("[A](./a.md)", ["docs/a.md", "docs/b.md"])).toEqual(["docs/b.md"]);
  });

  test("ADR files and font licences are covered by other indexes", () => {
    const documents = documentsRequiringIndex([
      "docs/adr/0001-x.md",
      "docs/adr/README.md",
      "docs/brand/brandbook/fonts/OFL.md",
      "docs/new.md",
    ]);
    expect(documents).toEqual(["docs/adr/README.md", "docs/new.md"]);
  });
});

describe("skills lock", () => {
  test("skills-lock.json matches the directories in .claude/skills", () => {
    const lock = JSON.parse(
      readFileSync(path.join(repositoryRoot, "skills-lock.json"), "utf8"),
    ) as {
      skills: Record<string, unknown>;
    };
    const directoryNames = readdirSync(path.join(repositoryRoot, ".claude/skills"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(skillLockDrift(Object.keys(lock.skills), directoryNames)).toEqual({
      missingFromLock: [],
      missingFromDisk: [],
    });
  });

  test("a skill missing from the lock is detected", () => {
    expect(skillLockDrift(["a"], ["a", "b"])).toEqual({
      missingFromLock: ["b"],
      missingFromDisk: [],
    });
  });

  test("a locked skill missing from disk is detected", () => {
    expect(skillLockDrift(["a", "b"], ["a"])).toEqual({
      missingFromLock: [],
      missingFromDisk: ["b"],
    });
  });
});
