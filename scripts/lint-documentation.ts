import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Pinned lychee release. It is the default `lycheeVersion` of the
 * `lycheeverse/lychee-action` version in {@link EXPECTED_LYCHEE_ACTION_VERSION}.
 */
export const LYCHEE_VERSION = "v0.24.2";

/**
 * The `lycheeverse/lychee-action` version pinned in
 * `.github/workflows/lint-docs.yml`. `scripts/lint-documentation.test.ts` asserts the
 * workflow still pins it, so bumping the action fails the test until
 * {@link LYCHEE_VERSION} is re-checked against the new action default.
 */
export const EXPECTED_LYCHEE_ACTION_VERSION = "v2.9.0";

/**
 * Arguments passed to lychee, identical to the `args:` of the workflow.
 * Globs are passed unexpanded, as the workflow's quoting does.
 */
export const LYCHEE_ARGS = [
  "--offline",
  "--include-fragments=anchor-only",
  "--no-progress",
  "*.md",
  "docs/**/*.md",
  ".github/**/*.md",
] as const;

/**
 * Maps Node platform and architecture to the lychee Linux release arch.
 * @param arch The Node.js architecture.
 * @param platform The Node.js platform.
 * @returns The lychee release architecture string.
 */
export function resolveLycheeArch(
  arch: NodeJS.Architecture = process.arch,
  platform: NodeJS.Platform = process.platform,
): "aarch64" | "x86_64" {
  if (platform !== "linux") {
    throw new Error(
      `lint-docs: unsupported platform "${platform}", lychee prebuilt binaries are Linux-only. Install lychee manually.`,
    );
  }
  if (arch === "arm64") return "aarch64";
  if (arch === "x64") return "x86_64";
  throw new Error(
    `lint-docs: unsupported architecture "${arch}", lychee only publishes x86_64 and aarch64 Linux binaries.`,
  );
}

/**
 * Builds the release asset URL for a lychee version and architecture.
 * @param version The release tag, such as `v0.24.2`.
 * @param arch The CPU part of the asset name, such as `x86_64`.
 * @returns An https GitHub release asset link.
 */
export function buildLycheeDownloadUrl(version: string, arch: string): string {
  return `https://github.com/lycheeverse/lychee/releases/download/lychee-${version}/lychee-${arch}-unknown-linux-gnu.tar.gz`;
}

/**
 * Builds the cache path, relative to the git common dir, of a lychee binary.
 * @param version The release tag the binary belongs to.
 * @returns A path like `lychee/v0.24.2/lychee`.
 */
export function buildLycheeCacheRelativePath(version: string): string {
  return path.join("lychee", version, "lychee");
}

/**
Injectable collaborators of {@link ensureLycheeBinary}.
 */
export interface LycheeBinaryDependencies {
  resolveCacheRoot: () => string;
  fetchArchive: (url: string) => Promise<Response>;
  arch: NodeJS.Architecture;
  platform: NodeJS.Platform;
}

function resolveGitCommonDirectory(): string {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`lint-docs: "git rev-parse --git-common-dir" failed: ${result.stderr}`);
  }
  return path.resolve(result.stdout.trim());
}

function findBinaryRecursively(rootDirectory: string, maxDepth: number): string | undefined {
  const entries = readdirSync(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootDirectory, entry.name);
    if (entry.isFile() && entry.name === "lychee") return entryPath;
    if (!entry.isDirectory() || maxDepth <= 0) continue;
    const found = findBinaryRecursively(entryPath, maxDepth - 1);
    if (found) return found;
  }
  return undefined;
}

async function downloadLycheeBinary(
  version: string,
  destinationPath: string,
  dependencies: LycheeBinaryDependencies,
): Promise<void> {
  const url = buildLycheeDownloadUrl(
    version,
    resolveLycheeArch(dependencies.arch, dependencies.platform),
  );
  const response = await dependencies.fetchArchive(url);
  if (!response.ok) {
    throw new Error(
      `lint-docs: failed to download lychee from ${url} (HTTP ${String(response.status)}).`,
    );
  }

  const workingDirectory = mkdtempSync(path.join(tmpdir(), "lint-docs-lychee-"));
  try {
    const archivePath = path.join(workingDirectory, "lychee.tar.gz");
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
    const extractedDirectory = path.join(workingDirectory, "extracted");
    mkdirSync(extractedDirectory);
    const tar = spawnSync("tar", ["-xzf", archivePath, "-C", extractedDirectory]);
    if (tar.status !== 0) {
      throw new Error(
        `lint-docs: failed to extract the archive from ${url}: ${tar.stderr.toString()}`,
      );
    }
    const extractedBinaryPath = findBinaryRecursively(extractedDirectory, 2);
    if (!extractedBinaryPath) {
      throw new Error(`lint-docs: no "lychee" binary found in ${url}.`);
    }
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    const temporaryPath = `${destinationPath}.tmp-${String(process.pid)}-${String(Date.now())}`;
    copyFileSync(extractedBinaryPath, temporaryPath);
    chmodSync(temporaryPath, 0o755);
    renameSync(temporaryPath, destinationPath);
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true });
  }
}

function defaultLycheeDependencies(): LycheeBinaryDependencies {
  return {
    resolveCacheRoot: resolveGitCommonDirectory,
    fetchArchive: (url) => fetch(url),
    arch: process.arch,
    platform: process.platform,
  };
}

/**
 * Returns a cached lychee binary, downloading it on first use.
 * @param version The lychee release version to ensure is cached.
 * @param dependencies The cache root, fetch and platform, defaulting to the real ones.
 * @returns The absolute path of the cached binary.
 */
export async function ensureLycheeBinary(
  version: string,
  dependencies: LycheeBinaryDependencies = defaultLycheeDependencies(),
): Promise<string> {
  const binaryPath = path.join(
    dependencies.resolveCacheRoot(),
    buildLycheeCacheRelativePath(version),
  );
  if (existsSync(binaryPath)) return binaryPath;
  console.log(`lint-docs: lychee ${version} not cached, downloading...`);
  await downloadLycheeBinary(version, binaryPath, dependencies);
  console.log(`lint-docs: cached lychee ${version} at ${binaryPath}.`);
  return binaryPath;
}

function exitCodeOf(code: number | null): number {
  return typeof code === "number" ? code : 1;
}

function spawnInherited(binaryPath: string, binaryArguments: string[]): Promise<number> {
  const child = spawn(binaryPath, binaryArguments, { stdio: "inherit" });
  return new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(exitCodeOf(code));
    });
  });
}

/**
A Markdown link whose target is a gitignored path.
 */
export interface IgnoredLink {
  file: string;
  target: string;
}

const MARKDOWN_LINK_PATTERN = /\]\(([^)\s]+)/g;
const EXTERNAL_TARGET_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;

/**
 * Finds relative links, in tracked Markdown files, that point at gitignored
 * paths. Such links work locally but break for anyone who clones the repo.
 * @param files Repo-relative Markdown file paths.
 * @param readFile Returns the text of a repo-relative file.
 * @param isIgnored Tells whether a repo-relative path is gitignored.
 * @returns The offending links, in file and source order.
 */
export function findLinksToIgnoredPaths(
  files: string[],
  readFile: (file: string) => string,
  isIgnored: (repositoryPath: string) => boolean,
): IgnoredLink[] {
  const found: IgnoredLink[] = [];
  for (const file of files) {
    for (const match of readFile(file).matchAll(MARKDOWN_LINK_PATTERN)) {
      const rawTarget = match[1]?.split("#", 1)[0] ?? "";
      if (rawTarget === "" || EXTERNAL_TARGET_PATTERN.test(rawTarget)) continue;
      const resolved = rawTarget.startsWith("/")
        ? path.posix.normalize(rawTarget.slice(1))
        : path.posix.join(path.posix.dirname(file), rawTarget);
      if (isIgnored(resolved.replace(/\/$/, ""))) {
        found.push({ file, target: resolved });
      }
    }
  }
  return found;
}

function listTrackedMarkdownFiles(): string[] {
  const result = spawnSync("git", ["ls-files", "--", "*.md"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`lint-docs: "git ls-files" failed: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
}

/**
 * Builds `--exclude-path` arguments for gitignored Markdown files that exist
 * on disk, so private local docs are not checked as lychee inputs.
 * @returns The lychee arguments, empty when nothing is ignored.
 */
export function buildIgnoredMarkdownExcludeArguments(): string[] {
  const result = spawnSync(
    "git",
    ["ls-files", "--others", "--ignored", "--exclude-standard", "--", "*.md"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`lint-docs: "git ls-files" failed: ${result.stderr}`);
  }
  return result.stdout
    .split("\n")
    .flatMap((line) =>
      line === "" || line.startsWith("node_modules/") ? [] : ["--exclude-path", line],
    );
}

function isGitIgnored(repositoryPath: string): boolean {
  return spawnSync("git", ["check-ignore", "-q", "--", repositoryPath]).status === 0;
}

function findIgnoredLinksInRepository(): IgnoredLink[] {
  return findLinksToIgnoredPaths(
    listTrackedMarkdownFiles(),
    (file) => readFileSync(file, "utf8"),
    isGitIgnored,
  );
}

/**
 * Runs lychee over the docs with the cached pinned binary, after failing on
 * links to gitignored paths.
 * @param extraArguments Arguments appended to {@link LYCHEE_ARGS}.
 * @param ensureBinary Resolves the lychee binary path.
 * @param spawnBinary Runs the binary and resolves its exit code.
 * @param findIgnoredLinks Lists links that target gitignored paths.
 * @returns The lychee exit code, or 1 when an ignored link exists.
 */
export async function runDocumentationLint(
  extraArguments: string[] = process.argv.slice(2),
  ensureBinary: (version: string) => Promise<string> = ensureLycheeBinary,
  spawnBinary: (binaryPath: string, binaryArguments: string[]) => Promise<number> = spawnInherited,
  findIgnoredLinks: () => IgnoredLink[] = findIgnoredLinksInRepository,
): Promise<number> {
  const ignoredLinks = findIgnoredLinks();
  for (const { file, target } of ignoredLinks) {
    console.error(`lint-docs: ${file} links to gitignored path ${target}`);
  }
  if (ignoredLinks.length > 0) return 1;
  const binaryPath = await ensureBinary(LYCHEE_VERSION);
  return spawnBinary(binaryPath, [...LYCHEE_ARGS, ...extraArguments]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await runDocumentationLint([
      ...buildIgnoredMarkdownExcludeArguments(),
      ...process.argv.slice(2),
    ]);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
