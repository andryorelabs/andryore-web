import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

/**
 * The toolchain version table of the cross-repo standard v2 (aokit
 * `docs/standards/tooling.md`, "Toolchain versions (E15)"). Update a row here
 * only together with the standard.
 */
const TOOLCHAIN_TABLE: ReadonlyMap<string, string> = new Map([
  ["oxlint", "1.92.0"],
  ["oxfmt", "0.75.0"],
  ["oxlint-tsgolint", "7.0.2005"],
  ["typescript7", "npm:typescript@7.1.0-beta"],
  ["typescript", "npm:@typescript/typescript6@6.0.2"],
  ["Bun (packageManager)", "bun@1.4.4"],
  ["@types/bun", "1.4.4"],
  [".node-version", "26"],
  ["actionlint", "1.7.12"],
  ["zizmor", "1.32.0"],
  ["lycheeverse/lychee-action", "e7477775783ea5526144ba13e8db5eec57747ce8"],
]);

/**
 * Packages the standard pins exactly; any other package may carry a caret range.
 */
const EXACT_PINS = new Set(["oxlint", "oxfmt", "oxlint-tsgolint", "typescript7", "typescript"]);

/**
 * The files a toolchain drift check reads, already loaded.
 */
interface ToolchainSources {
  readonly manifest: Manifest;
  readonly nodeVersion: string;
  readonly workflows: ReadonlyMap<string, string>;
}

interface Manifest {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function declaredRange(manifest: Manifest, packageName: string): string | undefined {
  return manifest.devDependencies?.[packageName] ?? manifest.dependencies?.[packageName];
}

function checkPackageRow(tool: string, version: string, sources: ToolchainSources): string[] {
  const range = declaredRange(sources.manifest, tool);
  if (range === undefined) return [`package.json does not declare ${tool} (table: ${version})`];
  const declared = EXACT_PINS.has(tool) ? range : range.replace(/^\^/, "");
  return declared === version ? [] : [`package.json ${tool} is ${range}, table says ${version}`];
}

function workflowValues(
  workflows: ReadonlyMap<string, string>,
  pattern: RegExp,
): { file: string; value: string }[] {
  return [...workflows].flatMap(([file, text]) =>
    Array.from(text.matchAll(pattern), (match) => ({
      file,
      value: match[1] ?? "",
    })),
  );
}

function checkWorkflowRow(
  tool: string,
  version: string,
  pattern: RegExp,
  sources: ToolchainSources,
): string[] {
  const found = workflowValues(sources.workflows, pattern);
  return found.length === 0
    ? [`no workflow pins ${tool} (table: ${version})`]
    : found
        .filter(({ value }) => value !== version)
        .map(({ file, value }) => `${file} pins ${tool} ${value}, table says ${version}`);
}

function checkNodeRow(version: string, sources: ToolchainSources): string[] {
  const declared = sources.nodeVersion.trim();
  const problems =
    declared === version ? [] : [`.node-version is ${declared}, table says ${version}`];
  for (const { file } of workflowValues(sources.workflows, /^\s*node-version:\s*(\S+)/gm)) {
    problems.push(`${file} sets node-version directly instead of reading .node-version`);
  }
  return problems;
}

function checkRow(tool: string, version: string, sources: ToolchainSources): string[] {
  switch (tool) {
    case "Bun (packageManager)": {
      const { packageManager } = sources.manifest;
      return packageManager === version
        ? []
        : [`package.json packageManager is ${String(packageManager)}, table says ${version}`];
    }
    case ".node-version": {
      return checkNodeRow(version, sources);
    }
    case "actionlint": {
      return checkWorkflowRow(tool, version, /^\s*ACTIONLINT_VERSION:\s*(\S+)/gm, sources);
    }
    case "zizmor": {
      return checkWorkflowRow(tool, version, /^\s*ZIZMOR_VERSION:\s*(\S+)/gm, sources);
    }
    case "lycheeverse/lychee-action": {
      return checkWorkflowRow(tool, version, /lycheeverse\/lychee-action@([\da-f]+)/g, sources);
    }
    default: {
      return checkPackageRow(tool, version, sources);
    }
  }
}

function findToolchainDrift(
  table: ReadonlyMap<string, string>,
  sources: ToolchainSources,
): string[] {
  return [...table].flatMap(([tool, version]) => checkRow(tool, version, sources));
}

function readRepositorySources(): ToolchainSources {
  const workflowDirectory = path.join(REPO_ROOT, ".github", "workflows");
  const workflowFiles = readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name));
  return {
    manifest: JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as Manifest,
    nodeVersion: readFileSync(path.join(REPO_ROOT, ".node-version"), "utf8"),
    workflows: new Map(
      workflowFiles.map((name) => [name, readFileSync(path.join(workflowDirectory, name), "utf8")]),
    ),
  };
}

const SAMPLE_TABLE: ReadonlyMap<string, string> = new Map([
  ["oxfmt", "0.75.0"],
  ["@types/bun", "1.4.4"],
  ["Bun (packageManager)", "bun@1.4.4"],
  [".node-version", "26"],
  ["actionlint", "1.7.12"],
  ["lycheeverse/lychee-action", "e747"],
]);

function sampleSources(overrides: Partial<ToolchainSources> = {}): ToolchainSources {
  return {
    manifest: {
      packageManager: "bun@1.4.4",
      devDependencies: { oxfmt: "0.75.0", "@types/bun": "^1.4.4" },
    },
    nodeVersion: "26\n",
    workflows: new Map([
      [
        "ci.yml",
        "          ACTIONLINT_VERSION: 1.7.12\n      - uses: lycheeverse/lychee-action@e747 # v2.9.0\n",
      ],
    ]),
    ...overrides,
  };
}

describe("toolchain drift (E15)", () => {
  test("matching sources have no drift", () => {
    expect(findToolchainDrift(SAMPLE_TABLE, sampleSources())).toEqual([]);
  });

  test("WHEN a package pin differs from the table THEN the drift check fails", () => {
    const drift = findToolchainDrift(
      SAMPLE_TABLE,
      sampleSources({
        manifest: {
          packageManager: "bun@1.4.3",
          dependencies: { oxfmt: "0.74.0", "@types/bun": "^1.4.4" },
        },
      }),
    );
    expect(drift).toEqual([
      "package.json oxfmt is 0.74.0, table says 0.75.0",
      "package.json packageManager is bun@1.4.3, table says bun@1.4.4",
    ]);
  });

  test("an exact pin may not become a range", () => {
    const drift = findToolchainDrift(
      SAMPLE_TABLE,
      sampleSources({
        manifest: {
          packageManager: "bun@1.4.4",
          devDependencies: { oxfmt: "^0.75.0", "@types/bun": "^1.4.4" },
        },
      }),
    );
    expect(drift).toEqual(["package.json oxfmt is ^0.75.0, table says 0.75.0"]);
  });

  test("flags .node-version, workflow pins and a hard-coded node-version", () => {
    const drift = findToolchainDrift(
      SAMPLE_TABLE,
      sampleSources({
        nodeVersion: "24\n",
        workflows: new Map([
          [
            "ci.yml",
            "          node-version: 24\n          ACTIONLINT_VERSION: 1.7.11\n      - uses: lycheeverse/lychee-action@f00 # v2.8.0\n",
          ],
        ]),
      }),
    );
    expect(drift).toEqual([
      ".node-version is 24, table says 26",
      "ci.yml sets node-version directly instead of reading .node-version",
      "ci.yml pins actionlint 1.7.11, table says 1.7.12",
      "ci.yml pins lycheeverse/lychee-action f00, table says e747",
    ]);
  });

  test("a table row with no source is drift", () => {
    const drift = findToolchainDrift(
      new Map([...SAMPLE_TABLE, ["zizmor", "1.32.0"]]),
      sampleSources({ workflows: new Map(), manifest: {} }),
    );
    expect(drift).toContain("package.json does not declare oxfmt (table: 0.75.0)");
    expect(drift).toContain("package.json packageManager is undefined, table says bun@1.4.4");
    expect(drift).toContain("no workflow pins actionlint (table: 1.7.12)");
    expect(drift).toContain("no workflow pins zizmor (table: 1.32.0)");
  });

  test("the repository matches the standard's toolchain table", () => {
    expect(findToolchainDrift(TOOLCHAIN_TABLE, readRepositorySources())).toEqual([]);
  });
});

/**
 * The custom managers in `renovate.json5` that keep non-npm pins Renovate-managed.
 */
interface CustomManager {
  managerFilePatterns: string[];
  matchStrings: string[];
}

const renovateConfig = Bun.JSON5.parse(
  readFileSync(path.join(REPO_ROOT, "renovate.json5"), "utf8"),
) as { customManagers?: CustomManager[] };

function managedFile(relativePath: string): CustomManager | undefined {
  return renovateConfig.customManagers?.find((manager) =>
    manager.managerFilePatterns.some((pattern) =>
      new RegExp(pattern.slice(1, -1)).test(relativePath),
    ),
  );
}

function matchedValues(relativePath: string): string[] {
  const manager = managedFile(relativePath);
  const text = readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
  return (manager?.matchStrings ?? []).flatMap((matchString) =>
    Array.from(
      text.matchAll(new RegExp(matchString, "g")),
      (match) => match.groups?.currentValue ?? "",
    ),
  );
}

describe("every non-npm pin is Renovate-managed", () => {
  test("actionlint and zizmor in lint-workflows.yml", () => {
    expect(
      matchedValues(".github/workflows/lint-workflows.yml").toSorted((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual(["1.32.0", "1.7.12"]);
  });

  test("LYCHEE_VERSION in scripts/lint-documentation.ts", () => {
    expect(matchedValues("scripts/lint-documentation.ts")).toEqual(["v0.24.2"]);
  });

  test("LIGHTHOUSE_VERSION in scripts/lighthouse-budget.ts", () => {
    expect(matchedValues("scripts/lighthouse-budget.ts")).toEqual(["13.5.0"]);
  });
});

/**
 * The standard's `sortImports` (E13): the common base with the Astro variant's
 * custom group and group order.
 */
const STANDARD_SORT_IMPORTS = {
  internalPattern: ["@/"],
  ignoreCase: true,
  newlinesBetween: true,
  customGroups: [
    {
      groupName: "astro",
      elementNamePattern: ["astro", "astro/**", "astro:*"],
    },
  ],
  groups: [
    "builtin",
    { newlinesBetween: false },
    "astro",
    { newlinesBetween: false },
    "external",
    "internal",
    ["parent", "sibling", "index"],
    "unknown",
  ],
};

function readRepositoryJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), "utf8"));
}

const formatConfig = readRepositoryJson(".oxfmtrc.json") as {
  sortImports?: unknown;
  ignorePatterns?: string[];
};

/**
 * Reads the glob keys of `lint-staged.config.mjs` whose command list runs oxfmt.
 * @returns The globs, as written in the config.
 */
function lintStagedOxfmtGlobs(): string[] {
  const text = readFileSync(path.join(REPO_ROOT, "lint-staged.config.mjs"), "utf8");
  return Array.from(text.matchAll(/"([^"]+)":\s*\[([^\]]*)\]/g), (match) => ({
    glob: match[1] ?? "",
    commands: match[2] ?? "",
  }))
    .filter(({ commands }) => commands.includes("oxfmt"))
    .map(({ glob }) => glob);
}

function ignoringPatterns(file: string): string[] {
  return (formatConfig.ignorePatterns ?? []).filter((pattern) => new Bun.Glob(pattern).match(file));
}

describe("format config (E13)", () => {
  test(".oxfmtrc.json carries the standard's sortImports", () => {
    expect(formatConfig.sortImports).toEqual(STANDARD_SORT_IMPORTS);
  });

  test("the oxfmt scope keeps .mts, .cts and .jsonc files", () => {
    for (const file of ["config.mts", "config.cts", "settings.jsonc", "src/a.mts"]) {
      expect(ignoringPatterns(file)).toEqual([]);
    }
  });

  test("lint-staged formats .mts, .cts and .jsonc files", () => {
    const globs = lintStagedOxfmtGlobs();
    for (const file of ["config.mts", "config.cts", "settings.jsonc"]) {
      expect(globs.some((glob) => new Bun.Glob(glob).match(file))).toBe(true);
    }
  });
});

describe("tsconfig (E14)", () => {
  const tsconfig = readRepositoryJson("tsconfig.json") as {
    compilerOptions: Record<string, unknown>;
    include: string[];
  };

  test("the root tsconfig includes root *.ts and *.mts config files", () => {
    expect(["*.ts", "*.mts"].filter((pattern) => !tsconfig.include.includes(pattern))).toEqual([]);
  });

  test("the root tsconfig sets the standard's module and casing options", () => {
    expect(tsconfig.compilerOptions).toMatchObject({
      moduleDetection: "force",
      isolatedModules: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
    });
  });
});
