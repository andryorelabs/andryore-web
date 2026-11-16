import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dir, "..");
const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]s|tsx|astro)$/;
const TEST_FILE_PATTERN = /\.test\.[cm]?[jt]sx?$/;
const IGNORED_PREFIXES: readonly string[] = [".claude/", "node_modules/"];
const ENVIRONMENT_READ_PATTERN =
  /\b(?:process\.env|import\.meta\.env|environment)\.([A-Z][A-Z\d_]*)\b/g;

function findEnvironmentReads(source: string): string[] {
  return Array.from(source.matchAll(ENVIRONMENT_READ_PATTERN), (match) => match[1] ?? "");
}

function findUndocumentedVariables(
  reads: ReadonlyMap<string, readonly string[]>,
  documentation: string,
): string[] {
  const violations: string[] = [];
  for (const [name, files] of reads) {
    if (!documentation.includes(`\`${name}\``)) {
      violations.push(
        `${name} (read in ${files.join(", ")}) is missing from docs/configuration.md`,
      );
    }
  }
  return violations;
}

function listSourceFiles(): string[] {
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
    .filter(
      (filePath) =>
        SOURCE_FILE_PATTERN.test(filePath) &&
        !TEST_FILE_PATTERN.test(filePath) &&
        IGNORED_PREFIXES.every((prefix) => !filePath.startsWith(prefix)) &&
        existsSync(path.join(repositoryRoot, filePath)),
    );
}

function collectReads(): Map<string, string[]> {
  const reads = new Map<string, string[]>();
  for (const filePath of listSourceFiles()) {
    const source = readFileSync(path.join(repositoryRoot, filePath), "utf8");
    for (const name of findEnvironmentReads(source)) {
      const files = reads.get(name) ?? [];
      reads.set(name, files.includes(filePath) ? files : [...files, filePath]);
    }
  }
  return reads;
}

describe("environment variable documentation", () => {
  it("documents every variable the code reads", () => {
    const documentation = readFileSync(path.join(repositoryRoot, "docs/configuration.md"), "utf8");
    const reads = collectReads();
    expect(reads.size).toBeGreaterThan(0);
    expect(findUndocumentedVariables(reads, documentation)).toEqual([]);
  });

  it("finds reads through process.env, import.meta.env and environment", () => {
    const source = "process.env.A_ONE; import.meta.env.B_TWO; environment.C_3; env.lower;";
    expect(findEnvironmentReads(source)).toEqual(["A_ONE", "B_TWO", "C_3"]);
  });

  it("names an undocumented variable", () => {
    const reads = new Map([["SECRET_THING", ["src/a.ts"]]]);
    expect(findUndocumentedVariables(reads, "`OTHER`")).toEqual([
      "SECRET_THING (read in src/a.ts) is missing from docs/configuration.md",
    ]);
    expect(findUndocumentedVariables(reads, "`SECRET_THING`")).toEqual([]);
  });
});
