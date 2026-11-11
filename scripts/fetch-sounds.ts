import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { usableCredential } from "../src/lib/credential";
import { isSoundManifest, SOUND_FILES } from "../src/lib/sound-engine";

const DEFAULT_SECRET_PATH = "/run/secrets/sounds_token";
const DEFAULT_OUTPUT = path.resolve(import.meta.dir, "../public/sounds");
const API_ROOT = "https://api.github.com";

interface ContentEntry {
  name: string;
  type: string;
  url: string;
}

/**
What the fetch step needs, replaceable in tests.
 */
export interface FetchSoundsOptions {
  repo: string;
  ref: string;
  token: string;
  outputDirectory: string;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
}

/**
The process pieces `main` reads, replaceable in tests.
 */
export interface MainEnvironment {
  env: Readonly<Record<string, string | undefined>>;
  secretPath?: string;
  outputDirectory?: string;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

function isContentEntry(value: unknown): value is ContentEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === "string" &&
    typeof entry.type === "string" &&
    typeof entry.url === "string"
  );
}

/**
 * Downloads the private repository's `sounds/` folder into a directory and
 * checks that the manifest and every file it lists arrived.
 * @param options The source repository, the read-only token and the target.
 * @returns The names of the files written.
 * @throws {Error} When a request fails or the downloaded set is incomplete.
 */
export async function fetchSounds(options: FetchSoundsOptions): Promise<string[]> {
  const request = options.fetch ?? globalThis.fetch;
  const headers = {
    Authorization: `Bearer ${options.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const listing = await request(
    `${API_ROOT}/repos/${options.repo}/contents/sounds?ref=${encodeURIComponent(options.ref)}`,
    { headers: { ...headers, Accept: "application/vnd.github+json" } },
  );
  if (!listing.ok)
    throw new Error(
      `listing sounds/ in ${options.repo}@${options.ref} failed with ${String(listing.status)}`,
    );
  const entries = ((await listing.json()) as unknown[]).filter(isContentEntry);
  const files = entries.filter((entry) => entry.type === "file");
  mkdirSync(options.outputDirectory, { recursive: true });
  for (const entry of files) {
    const name = path.basename(entry.name);
    const response = await request(entry.url, {
      headers: { ...headers, Accept: "application/vnd.github.raw+json" },
    });
    if (!response.ok) throw new Error(`downloading ${name} failed with ${String(response.status)}`);
    writeFileSync(
      path.join(options.outputDirectory, name),
      new Uint8Array(await response.arrayBuffer()),
    );
  }
  verifySounds(options.outputDirectory);
  return files.map((entry) => path.basename(entry.name));
}

/**
 * Checks that `manifest.json` is complete and every sound file exists.
 * @param directory The folder holding the downloaded sounds.
 * @throws {Error} When the manifest is missing, malformed or a file is absent.
 */
export function verifySounds(directory: string): void {
  const manifestPath = path.join(directory, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error("manifest.json is missing");
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    throw new Error("manifest.json is not valid JSON");
  }
  if (!isSoundManifest(manifest)) throw new Error("manifest.json does not list every sound");
  for (const name of SOUND_FILES)
    if (!existsSync(path.join(directory, `${name}.mp3`))) throw new Error(`${name}.mp3 is missing`);
}

/**
 * Entry point: skips quietly without a token so builds without audio work.
 * Never prints the token.
 * @param environment The environment, secret path and sinks to use.
 * @returns The process exit code.
 */
export async function main(environment: MainEnvironment): Promise<number> {
  const log = environment.log ?? console.log;
  const error = environment.error ?? console.error;
  const secretPath = environment.secretPath ?? DEFAULT_SECRET_PATH;
  const token = (
    usableCredential(environment.env.SOUNDS_TOKEN) ??
    (existsSync(secretPath) ? readFileSync(secretPath, "utf8") : "")
  ).trim();
  if (!token) {
    log("fetch-sounds: no token, building without sound");
    return 0;
  }
  const repository = environment.env.SOUNDS_REPO?.trim();
  if (!repository) {
    error("fetch-sounds: SOUNDS_REPO is required when a token is provided");
    return 1;
  }
  const requestedReference = environment.env.SOUNDS_REF?.trim();
  const ref =
    requestedReference === undefined || requestedReference === "" ? "main" : requestedReference;
  try {
    const written = await fetchSounds({
      repo: repository,
      ref,
      token,
      outputDirectory: environment.outputDirectory ?? DEFAULT_OUTPUT,
      ...(environment.fetch && { fetch: environment.fetch }),
    });
    log(`fetch-sounds: ${String(written.length)} files from ${repository}@${ref}`);
    return 0;
  } catch (error_) {
    const message = error_ instanceof Error ? error_.message : "failed";
    error(`fetch-sounds: ${message.split(token).join("***")}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main({ env: process.env });
}
