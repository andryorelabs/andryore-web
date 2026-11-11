import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const TYPESCRIPT7_TSC = path.join(REPO_ROOT, "node_modules/typescript7/bin/tsc");

interface PackageManifest {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
) as PackageManifest;

describe("typescript 7 compiler", () => {
  test("the typescript7 bin reports version 7.1", () => {
    const result = spawnSync(TYPESCRIPT7_TSC, ["--version"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^Version 7\.1\./);
  });

  test("typecheck syncs astro types, then runs tsc through the typescript7 bin with the content mapper", () => {
    expect(manifest.scripts.typecheck).toBe(
      "astro sync && node_modules/typescript7/bin/tsc --noEmit --runExternalCode",
    );
  });

  test("astro check is replaced by the content mapper", () => {
    expect(manifest.devDependencies["@astrojs/check"]).toBeUndefined();
    expect(manifest.devDependencies["@astrojs/ts-content-mapper"]).toBe("0.2.0");
  });

  test("typescript7 is an exact alias of the 7.1 beta", () => {
    expect(manifest.devDependencies.typescript7).toBe("npm:typescript@7.1.0-beta");
  });
});

describe("typescript JS API", () => {
  test("the typescript package stays on the 6.x API", () => {
    const require = createRequire(import.meta.url);
    const typescript = require("typescript") as { version: string };

    expect(typescript.version).toMatch(/^6\./);
  });
});
