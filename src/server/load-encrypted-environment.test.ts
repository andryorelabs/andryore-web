import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { set } from "@dotenvx/dotenvx";

import { hasLoadedEncryptedEnvironment } from "./load-encrypted-environment";

describe("hasLoadedEncryptedEnvironment", () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "load-env-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test("loads nothing without a private key", () => {
    const environmentFile = path.join(directory, ".env");
    writeFileSync(environmentFile, "GITHUB_TOKEN=plain\n");
    const environment: Record<string, string> = {};
    expect(
      hasLoadedEncryptedEnvironment({
        envFile: environmentFile,
        env: environment,
      }),
    ).toBe(false);
    expect(environment.GITHUB_TOKEN).toBeUndefined();
  });

  test("loads nothing when the file is missing", () => {
    const environment: Record<string, string> = {
      DOTENV_PRIVATE_KEY: "a".repeat(64),
    };
    const environmentFile = path.join(directory, "absent.env");
    expect(
      hasLoadedEncryptedEnvironment({
        envFile: environmentFile,
        env: environment,
      }),
    ).toBe(false);
    expect(environment.GITHUB_TOKEN).toBeUndefined();
  });

  test("does not throw on a wrong key", () => {
    const environmentFile = path.join(directory, ".env");
    writeFileSync(environmentFile, "GITHUB_TOKEN=plain\n");
    const environment: Record<string, string> = {
      DOTENV_PRIVATE_KEY: "not-a-key",
    };
    expect(() =>
      hasLoadedEncryptedEnvironment({
        envFile: environmentFile,
        env: environment,
      }),
    ).not.toThrow();
  });

  test("decrypts the file when key and file are present", async () => {
    const environmentFile = path.join(directory, ".env");
    writeFileSync(environmentFile, "");
    await set("GITHUB_TOKEN", "secret-value", {
      path: environmentFile,
      envKeysFile: path.join(directory, ".env.keys"),
    });
    expect(readFileSync(environmentFile, "utf8")).not.toContain("secret-value");
    const keys = readFileSync(path.join(directory, ".env.keys"), "utf8");
    const privateKey = /DOTENV_PRIVATE_KEY="?([0-9a-f]+)"?/.exec(keys)?.[1];
    const environment: Record<string, string> = {
      DOTENV_PRIVATE_KEY: privateKey ?? "",
    };
    expect(
      hasLoadedEncryptedEnvironment({
        envFile: environmentFile,
        env: environment,
      }),
    ).toBe(true);
    expect(environment.GITHUB_TOKEN).toBe("secret-value");
  });
});
