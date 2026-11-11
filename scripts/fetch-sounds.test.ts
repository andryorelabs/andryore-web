import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { fetchSounds, main, verifySounds } from "./fetch-sounds";

const TOKEN = "github_pat_SECRET123";
const NAMES = ["click", "sel2", "theme", "copy", "cv", "live", "pop"];

const workspace = { directory: "" };
const noop = (): void => {
  return;
};

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "";
}

beforeEach(() => {
  workspace.directory = mkdtempSync(path.join(tmpdir(), "fetch-sounds-"));
});
afterEach(() => {
  rmSync(workspace.directory, { recursive: true, force: true });
});

function fakeSource(options: { omit?: string; manifest?: string } = {}) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const files = new Map<string, string>();
  for (const name of NAMES) files.set(`${name}.mp3`, `audio-${name}`);
  files.set("manifest.json", options.manifest ?? JSON.stringify({ sounds: NAMES }));
  if (options.omit) files.delete(options.omit);
  const fetch = (input: string, init: RequestInit): Promise<Response> => {
    calls.push({ url: input, headers: init.headers as Record<string, string> });
    if (input.includes("/contents/sounds?"))
      return Promise.resolve(
        Response.json(
          files
            .keys()
            .map((name) => ({
              name,
              type: "file",
              url: `https://api.github.com/raw/${name}`,
            }))
            .toArray(),
        ),
      );
    const name = input.split("/raw/", 2)[1] ?? "";
    return Promise.resolve(new Response(files.get(name) ?? "x"));
  };
  return { fetch, calls };
}

describe("main", () => {
  test("exits 0 without a token and writes nothing", async () => {
    const logs: string[] = [];
    const code = await main({
      env: {},
      secretPath: path.join(workspace.directory, "absent"),
      outputDirectory: path.join(workspace.directory, "out"),
      log: (message) => {
        logs.push(message);
      },
    });
    expect(code).toBe(0);
    expect(existsSync(path.join(workspace.directory, "out"))).toBe(false);
    expect(logs.join("")).toContain("without sound");
  });

  test("treats an empty secret file as no token", async () => {
    const secret = path.join(workspace.directory, "secret");
    writeFileSync(secret, "\n");
    const code = await main({
      env: {},
      secretPath: secret,
      log: noop,
    });
    expect(code).toBe(0);
  });

  test("treats dotenvx ciphertext as no token", async () => {
    const logs: string[] = [];
    const code = await main({
      env: { SOUNDS_TOKEN: "encrypted:BOwI3k" },
      secretPath: path.join(workspace.directory, "absent"),
      outputDirectory: path.join(workspace.directory, "out"),
      log: (message) => {
        logs.push(message);
      },
    });
    expect(code).toBe(0);
    expect(existsSync(path.join(workspace.directory, "out"))).toBe(false);
    expect(logs.join("")).toContain("without sound");
  });

  test("downloads with the secret file token and never logs it", async () => {
    const secret = path.join(workspace.directory, "secret");
    writeFileSync(secret, `${TOKEN}\n`);
    const source = fakeSource();
    const logs: string[] = [];
    const out = path.join(workspace.directory, "out");
    const code = await main({
      env: { SOUNDS_REPO: "owner/private", SOUNDS_REF: "v1" },
      secretPath: secret,
      outputDirectory: out,
      fetch: source.fetch,
      log: (message) => {
        logs.push(message);
      },
      error: (message) => {
        logs.push(message);
      },
    });
    expect(code).toBe(0);
    expect(readFileSync(path.join(out, "click.mp3"), "utf8")).toBe("audio-click");
    expect(source.calls[0]?.url).toContain("owner/private/contents/sounds?ref=v1");
    expect(source.calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(logs.join("\n")).not.toContain(TOKEN);
  });

  test("fails when a token has no repository", async () => {
    const errors: string[] = [];
    const code = await main({
      env: { SOUNDS_TOKEN: TOKEN },
      error: (message) => {
        errors.push(message);
      },
    });
    expect(code).toBe(1);
    expect(errors.join("")).not.toContain(TOKEN);
  });

  test("fails and redacts the token when the download breaks", async () => {
    const errors: string[] = [];
    const code = await main({
      env: { SOUNDS_TOKEN: TOKEN, SOUNDS_REPO: `x/${TOKEN}` },
      outputDirectory: path.join(workspace.directory, "out"),
      fetch: () => Promise.resolve(new Response("no", { status: 404 })),
      error: (message) => {
        errors.push(message);
      },
    });
    expect(code).toBe(1);
    expect(errors.join("")).not.toContain(TOKEN);
    expect(errors.join("")).toContain("404");
  });
});

describe("fetchSounds", () => {
  test("fails when the manifest is missing from the repository", async () => {
    const source = fakeSource({ omit: "manifest.json" });
    const message = await failureOf(
      fetchSounds({
        repo: "a/b",
        ref: "main",
        token: TOKEN,
        outputDirectory: workspace.directory,
        fetch: source.fetch,
      }),
    );
    expect(message).toContain("manifest.json is missing");
  });

  test("fails when a listed sound is missing", async () => {
    const source = fakeSource({ omit: "pop.mp3" });
    const message = await failureOf(
      fetchSounds({
        repo: "a/b",
        ref: "main",
        token: TOKEN,
        outputDirectory: workspace.directory,
        fetch: source.fetch,
      }),
    );
    expect(message).toContain("pop.mp3 is missing");
  });
});

describe("verifySounds", () => {
  test("rejects invalid JSON and incomplete manifests", () => {
    writeFileSync(path.join(workspace.directory, "manifest.json"), "{");
    expect(() => {
      verifySounds(workspace.directory);
    }).toThrow("not valid JSON");
    writeFileSync(
      path.join(workspace.directory, "manifest.json"),
      JSON.stringify({ sounds: ["click"] }),
    );
    expect(() => {
      verifySounds(workspace.directory);
    }).toThrow("does not list every sound");
  });
});
