import { afterEach, beforeEach, describe, expect, mock, spyOn, test, type Mock } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildIgnoredMarkdownExcludeArguments,
  buildLycheeCacheRelativePath,
  buildLycheeDownloadUrl,
  ensureLycheeBinary,
  EXPECTED_LYCHEE_ACTION_VERSION,
  findLinksToIgnoredPaths,
  LYCHEE_ARGS,
  LYCHEE_VERSION,
  resolveLycheeArch,
  runDocumentationLint,
  type LycheeBinaryDependencies,
} from "./lint-documentation";
import { readWorkflow, readWorkflowText } from "./workflow-files";

const WORKFLOW_FILE = "lint-docs.yml";
const LYCHEE_ACTION_PREFIX = "lycheeverse/lychee-action@";

function findLycheeArguments(): string {
  const jobs = Object.values(readWorkflow(WORKFLOW_FILE).jobs ?? {});
  const steps = jobs.flatMap((job) => job.steps ?? []);
  const lycheeStep = steps.find((step) => step.uses?.startsWith(LYCHEE_ACTION_PREFIX));
  const lycheeArguments = lycheeStep?.with?.args;
  if (typeof lycheeArguments !== "string") {
    throw new TypeError(`No lychee-action step with string args in ${WORKFLOW_FILE}.`);
  }
  return lycheeArguments;
}

function tokenizeShellLikeArguments(input: string): string[] {
  return Array.from(input.matchAll(/'([^']*)'|(\S+)/g), (match) => match[1] ?? match[2] ?? "");
}

describe("LYCHEE_ARGS parity with the lint-docs workflow", () => {
  test("the script args match the lychee-action args", () => {
    expect(tokenizeShellLikeArguments(findLycheeArguments())).toEqual([...LYCHEE_ARGS]);
  });

  test("the workflow still pins the action version LYCHEE_VERSION assumes", () => {
    const match = new RegExp(String.raw`uses:\s*${LYCHEE_ACTION_PREFIX}\S+\s*#\s*(v[\d.]+)`).exec(
      readWorkflowText(WORKFLOW_FILE),
    );
    expect(match?.[1]).toBe(EXPECTED_LYCHEE_ACTION_VERSION);
  });
});

describe("resolveLycheeArch", () => {
  test("maps arm64 and x64 on linux", () => {
    expect(resolveLycheeArch("arm64", "linux")).toBe("aarch64");
    expect(resolveLycheeArch("x64", "linux")).toBe("x86_64");
  });

  test("throws for an unsupported architecture", () => {
    expect(() => resolveLycheeArch("ia32", "linux")).toThrow(/unsupported architecture/);
  });

  test("throws for a non-linux platform", () => {
    expect(() => resolveLycheeArch("x64", "darwin")).toThrow(/unsupported platform/);
  });
});

describe("lychee paths", () => {
  test("builds the release asset URL", () => {
    expect(buildLycheeDownloadUrl(LYCHEE_VERSION, "x86_64")).toBe(
      `https://github.com/lycheeverse/lychee/releases/download/lychee-${LYCHEE_VERSION}/lychee-x86_64-unknown-linux-gnu.tar.gz`,
    );
  });

  test("nests the cached binary under lychee/<version>/lychee", () => {
    expect(buildLycheeCacheRelativePath("v0.24.2")).toBe("lychee/v0.24.2/lychee");
  });
});

async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  throw new Error("Expected the promise to reject.");
}

function createArchive(directory: string, files: Record<string, string>): Buffer {
  const source = path.join(directory, "source");
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(source, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  const archivePath = path.join(directory, "fixture.tar.gz");
  const tar = spawnSync("tar", ["-czf", archivePath, "-C", source, "."]);
  if (tar.status !== 0) throw new Error(tar.stderr.toString());
  return readFileSync(archivePath);
}

describe("ensureLycheeBinary", () => {
  let root: string;
  let logSpy: Mock<() => void>;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "lint-docs-test-"));
    logSpy = spyOn(console, "log").mockImplementation(mock());
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  function createDependencies(
    fetchArchive: LycheeBinaryDependencies["fetchArchive"],
    overrides: Partial<LycheeBinaryDependencies> = {},
  ): LycheeBinaryDependencies {
    return {
      resolveCacheRoot: () => path.join(root, "cache"),
      fetchArchive,
      arch: "x64",
      platform: "linux",
      ...overrides,
    };
  }

  test("reuses a cached binary without fetching", async () => {
    const binaryPath = path.join(root, "cache", "lychee", "v1", "lychee");
    mkdirSync(path.dirname(binaryPath), { recursive: true });
    writeFileSync(binaryPath, "cached");
    const fetchArchive = mock();
    expect(await ensureLycheeBinary("v1", createDependencies(fetchArchive))).toBe(binaryPath);
    expect(fetchArchive).not.toHaveBeenCalled();
  });

  test("downloads, extracts and caches an executable binary", async () => {
    const archive = createArchive(root, { "nested/lychee": "binary" });
    const fetchArchive = mock().mockResolvedValue(new Response(new Uint8Array(archive)));
    const binaryPath = await ensureLycheeBinary("v1", createDependencies(fetchArchive));
    expect(fetchArchive).toHaveBeenCalledWith(buildLycheeDownloadUrl("v1", "x86_64"));
    expect(binaryPath).toBe(path.join(root, "cache", "lychee", "v1", "lychee"));
    expect(existsSync(binaryPath)).toBe(true);
    expect(statSync(binaryPath).mode & 0o111).not.toBe(0);
  });

  test("throws on an HTTP error", async () => {
    const fetchArchive = mock().mockResolvedValue(new Response("", { status: 404 }));
    const message = await rejectionMessage(
      ensureLycheeBinary("v1", createDependencies(fetchArchive)),
    );
    expect(message).toMatch(/HTTP 404/);
  });

  test("throws when the archive has no lychee binary", async () => {
    const archive = createArchive(root, { "readme.txt": "hello" });
    const fetchArchive = mock().mockResolvedValue(new Response(new Uint8Array(archive)));
    const message = await rejectionMessage(
      ensureLycheeBinary("v1", createDependencies(fetchArchive)),
    );
    expect(message).toMatch(/no "lychee" binary found/);
  });

  test("throws when the payload is not a tar archive", async () => {
    const fetchArchive = mock().mockResolvedValue(new Response("not a tarball"));
    const message = await rejectionMessage(
      ensureLycheeBinary("v1", createDependencies(fetchArchive)),
    );
    expect(message).toMatch(/failed to extract/);
  });

  test("throws for an unsupported architecture before fetching", async () => {
    const fetchArchive = mock();
    const message = await rejectionMessage(
      ensureLycheeBinary("v1", createDependencies(fetchArchive, { arch: "ia32" })),
    );
    expect(message).toMatch(/unsupported architecture/);
    expect(fetchArchive).not.toHaveBeenCalled();
  });
});

describe("runDocumentationLint", () => {
  test("runs lychee with the shared args plus the extra ones", async () => {
    const ensureBinary = mock().mockResolvedValue("/bin/lychee");
    const spawnBinary = mock().mockResolvedValue(2);
    expect(await runDocumentationLint(["--verbose"], ensureBinary, spawnBinary)).toBe(2);
    expect(ensureBinary).toHaveBeenCalledWith(LYCHEE_VERSION);
    expect(spawnBinary).toHaveBeenCalledWith("/bin/lychee", [...LYCHEE_ARGS, "--verbose"]);
  });

  test("returns the exit code of the spawned binary", async () => {
    const ensureBinary = mock().mockResolvedValue("/usr/bin/false");
    expect(await runDocumentationLint([], ensureBinary)).toBe(1);
  });

  test("resolves zero when the spawned binary succeeds", async () => {
    const ensureBinary = mock().mockResolvedValue("/usr/bin/true");
    expect(await runDocumentationLint([], ensureBinary)).toBe(0);
  });

  test("rejects when the binary cannot be spawned", async () => {
    const ensureBinary = mock().mockResolvedValue("/nonexistent/lychee");
    const message = await rejectionMessage(runDocumentationLint([], ensureBinary));
    expect(message).toBeString();
  });
});

describe("findLinksToIgnoredPaths", () => {
  const files: Record<string, string> = {
    "README.md": "[a](docs/private.md#top) [b](docs/public.md) [c](https://x.dev/docs/private.md)",
    "docs/guide.md":
      "[up](../docs/private.md) [abs](/docs/dir/) [anchor](#here) [mail](mailto:a@b.c)",
  };
  const ignored = new Set(["docs/private.md", "docs/dir"]);
  const readFile = (file: string): string => files[file] ?? "";
  const isIgnored = (target: string): boolean => ignored.has(target.replace(/\/$/, ""));

  test("reports relative links whose target is gitignored", () => {
    expect(findLinksToIgnoredPaths(Object.keys(files), readFile, isIgnored)).toEqual([
      { file: "README.md", target: "docs/private.md" },
      { file: "docs/guide.md", target: "docs/private.md" },
      { file: "docs/guide.md", target: "docs/dir/" },
    ]);
  });

  test("reports nothing when no link targets an ignored path", () => {
    expect(findLinksToIgnoredPaths(["README.md"], () => "[b](docs/public.md)", isIgnored)).toEqual(
      [],
    );
  });
});

describe("repository-backed lint", () => {
  const originalDirectory = process.cwd();
  const originalArgument = process.argv[1];
  const originalExitCode = process.exitCode;
  const directories: string[] = [];
  let importCounter = 0;

  afterEach(() => {
    process.chdir(originalDirectory);
    process.argv[1] = originalArgument ?? "";
    process.exitCode = originalExitCode;
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function makeDirectory(): string {
    const directory = mkdtempSync(path.join(tmpdir(), "lint-docs-repo-"));
    directories.push(directory);
    return directory;
  }

  function makeRepository(): string {
    const directory = makeDirectory();
    expect(spawnSync("git", ["init", "-q"], { cwd: directory }).status).toBe(0);
    writeFileSync(path.join(directory, ".gitignore"), "private.md\nnode_modules/\n");
    writeFileSync(path.join(directory, "README.md"), "[hidden](private.md)\n");
    writeFileSync(path.join(directory, "private.md"), "# private\n");
    mkdirSync(path.join(directory, "node_modules"));
    writeFileSync(path.join(directory, "node_modules", "dependency.md"), "# dependency\n");
    expect(spawnSync("git", ["add", "README.md", ".gitignore"], { cwd: directory }).status).toBe(0);
    return directory;
  }

  async function runEntry(directory: string): Promise<number | string | undefined> {
    process.chdir(directory);
    const modulePath = path.join(originalDirectory, "scripts", "lint-documentation.ts");
    process.argv[1] = modulePath;
    process.exitCode = undefined;
    importCounter += 1;
    await import(`${modulePath}?entry=${String(importCounter)}`);
    return process.exitCode;
  }

  test("excludes ignored Markdown files but not node_modules", () => {
    process.chdir(makeRepository());
    expect(buildIgnoredMarkdownExcludeArguments()).toEqual(["--exclude-path", "private.md"]);
  });

  test("throws when git ls-files fails outside a repository", () => {
    process.chdir(makeDirectory());
    expect(() => buildIgnoredMarkdownExcludeArguments()).toThrow(/git ls-files/);
  });

  test("runDocumentationLint rejects when tracked files cannot be listed", async () => {
    process.chdir(makeDirectory());
    const ensureBinary = mock().mockResolvedValue("/bin/lychee");
    const spawnBinary = mock().mockResolvedValue(0);
    let message = "";
    try {
      await runDocumentationLint([], ensureBinary, spawnBinary);
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/git ls-files/);
    expect(spawnBinary).not.toHaveBeenCalled();
  });

  test("the entry point fails on a link to a gitignored path", async () => {
    const error = spyOn(console, "error").mockImplementation((): void => undefined);
    expect(await runEntry(makeRepository())).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("links to gitignored path"));
    error.mockRestore();
  });

  test("the entry point reports a failure outside a repository", async () => {
    const error = spyOn(console, "error").mockImplementation((): void => undefined);
    expect(await runEntry(makeDirectory())).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("git ls-files"));
    error.mockRestore();
  });
});
