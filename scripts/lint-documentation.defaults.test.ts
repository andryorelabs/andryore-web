import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ensureLycheeBinary, runDocumentationLint } from "./lint-documentation.ts";

function writeExecutable(file: string, body: string): void {
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
}

async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the promise to reject");
}

function lintWithBinary(binaryPath: string, extraArguments: string[] = []) {
  return runDocumentationLint(extraArguments, () => Promise.resolve(binaryPath));
}

describe("default dependencies", () => {
  const originalPath = process.env.PATH;
  let root: string;
  let binDirectory: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "lint-docs-defaults-"));
    binDirectory = path.join(root, "bin");
    mkdirSync(binDirectory);
    writeExecutable(path.join(binDirectory, "git"), "exit 0");
    process.env.PATH = binDirectory;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    rmSync(root, { recursive: true, force: true });
  });

  test("caches under the git common dir without downloading", async () => {
    const commonDirectory = path.join(root, "common");
    const binaryPath = path.join(commonDirectory, "lychee", "v1", "lychee");
    mkdirSync(path.dirname(binaryPath), { recursive: true });
    writeFileSync(binaryPath, "cached");
    writeExecutable(
      path.join(binDirectory, "git"),
      `[ "$1 $2" = "rev-parse --git-common-dir" ] && echo '${commonDirectory}' && exit 0\nexit 2`,
    );
    const fetchSpy = spyOn(globalThis, "fetch");

    try {
      const resolved = await ensureLycheeBinary("v1");
      expect(resolved).toBe(binaryPath);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("throws when the git common dir cannot be resolved", async () => {
    writeExecutable(path.join(binDirectory, "git"), 'echo "fatal: not a repo" >&2\nexit 128');

    const message = await rejectionMessage(ensureLycheeBinary("v1"));

    expect(message).toMatch(/--git-common-dir" failed: fatal: not a repo/);
  });

  test("uses the global fetch for the default download", async () => {
    writeExecutable(path.join(binDirectory, "git"), `echo '${root}/common'`);
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 500 }),
    );
    const logSpy = spyOn(console, "log").mockImplementation(() => {
      return;
    });

    try {
      const message = await rejectionMessage(ensureLycheeBinary("v1"));
      expect(message).toMatch(/HTTP 500/);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]).toEqual([expect.stringContaining("lychee-v1")]);
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  test("spawns the binary with inherited stdio and returns its exit code", async () => {
    const binaryPath = path.join(root, "fake-lychee");
    writeExecutable(binaryPath, "exit 4");

    const code = await lintWithBinary(binaryPath, ["--verbose"]);

    expect(code).toBe(4);
  });

  test("maps a signal exit to code 1", async () => {
    const binaryPath = path.join(root, "fake-lychee");
    writeExecutable(binaryPath, "kill -KILL $$");

    const code = await lintWithBinary(binaryPath);

    expect(code).toBe(1);
  });

  test("rejects when the binary fails to spawn", async () => {
    const message = await rejectionMessage(lintWithBinary(path.join(root, "missing-lychee")));

    expect(message).toMatch(/ENOENT/);
  });
});
