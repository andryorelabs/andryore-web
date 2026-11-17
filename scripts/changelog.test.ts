import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dir, "..");
const KEEP_A_CHANGELOG_LINK = "https://keepachangelog.com/en/1.1.0/";
const SEMVER_LINK = "https://semver.org/spec/v2.0.0.html";
const VERSION_HEADING_PATTERN = /^## \[(Unreleased|\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?$/gm;
const ALLOWED_GROUPS: ReadonlySet<string> = new Set(["Added", "Changed", "Fixed"]);
const REFERENCE_PATTERN = /^\[([^\]]+)\]: (\S+)$/gm;

function findChangelogViolations(changelog: string): string[] {
  const violations: string[] = [];
  const preamble = changelog.split(/^## /m, 1)[0] ?? "";
  if (!preamble.startsWith("# Changelog")) {
    violations.push("missing the Changelog title");
  }
  if (!preamble.includes(KEEP_A_CHANGELOG_LINK)) {
    violations.push("preamble does not name Keep a Changelog");
  }
  if (!preamble.includes(SEMVER_LINK)) {
    violations.push("preamble does not name Semantic Versioning");
  }

  const references = new Map(
    Array.from(changelog.matchAll(REFERENCE_PATTERN), (match) => [match[1] ?? "", match[2] ?? ""]),
  );
  const headings = changelog.matchAll(VERSION_HEADING_PATTERN).toArray();
  if (headings.every((match) => match[1] !== "Unreleased")) {
    violations.push("missing the Unreleased heading");
  }
  for (const match of headings) {
    const heading = match[0];
    const label = match[1] ?? "";
    if (label !== "Unreleased" && match[2] === undefined) {
      violations.push(`${heading}: version heading needs a date`);
    }
    if (!references.has(label)) {
      violations.push(`${label}: version heading has no link reference`);
    }
  }

  for (const match of changelog.matchAll(/^### (.+)$/gm)) {
    const group = match[1] ?? "";
    if (!ALLOWED_GROUPS.has(group)) {
      violations.push(`${group}: group must be Added, Changed or Fixed`);
    }
  }
  return violations;
}

const VALID_FIXTURE = `# Changelog

Based on [Keep a Changelog](${KEEP_A_CHANGELOG_LINK}) and
[Semantic Versioning](${SEMVER_LINK}).

## [Unreleased]

### Added

- Something.

## [1.0.0] - 2026-11-16

### Fixed

- Something else.

[Unreleased]: https://github.com/andryorelabs/andryore-web/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/andryorelabs/andryore-web/releases/tag/v1.0.0
`;

describe("CHANGELOG.md", () => {
  it("follows Keep a Changelog", () => {
    const changelog = readFileSync(path.join(repositoryRoot, "CHANGELOG.md"), "utf8");
    expect(findChangelogViolations(changelog)).toEqual([]);
  });

  it("accepts a well-formed changelog", () => {
    expect(findChangelogViolations(VALID_FIXTURE)).toEqual([]);
  });

  it("flags a version heading without a link reference", () => {
    const broken = VALID_FIXTURE.replace(/^\[1\.0\.0\]: .*\n/m, "");
    expect(findChangelogViolations(broken)).toEqual([
      "1.0.0: version heading has no link reference",
    ]);
  });

  it("flags a missing preamble and a version heading without a date", () => {
    const broken = VALID_FIXTURE.replace("Based on", "Based on nothing").replace(
      "## [1.0.0] - 2026-11-16",
      "## [1.0.0]",
    );
    const stripped = broken.replace(KEEP_A_CHANGELOG_LINK, "").replace(SEMVER_LINK, "");
    expect(findChangelogViolations(stripped)).toEqual([
      "preamble does not name Keep a Changelog",
      "preamble does not name Semantic Versioning",
      "## [1.0.0]: version heading needs a date",
    ]);
  });

  it("flags a missing title, a missing Unreleased heading and an unknown group", () => {
    const broken = VALID_FIXTURE.replace("# Changelog", "# Log")
      .replace("## [Unreleased]", "## [0.9.0] - 2026-01-01")
      .replace("### Added", "### Removed")
      .replace("[Unreleased]:", "[0.9.0]:");
    expect(findChangelogViolations(broken)).toEqual([
      "missing the Changelog title",
      "missing the Unreleased heading",
      "Removed: group must be Added, Changed or Fixed",
    ]);
  });
});
