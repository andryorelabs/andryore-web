import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PUBLIC_ROOT = path.resolve(import.meta.dir, "../public");
const OG_MAX_BYTES = 300 * 1024;

const read = (file: string): string => readFileSync(path.join(PUBLIC_ROOT, file), "utf8");

describe("security.txt", () => {
  const fields = Object.fromEntries(
    read(".well-known/security.txt")
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split(": ") as [string, string]),
  );

  test("names a contact and a canonical url", () => {
    expect(fields.Contact).toBe("mailto:hello@andryore.dev");
    expect(fields.Canonical).toBe("https://andryore.dev/.well-known/security.txt");
  });

  test("expires in the future", () => {
    expect(Date.parse(fields.Expires ?? "")).toBeGreaterThan(Date.now());
  });
});

describe("manifest.webmanifest", () => {
  const manifest = JSON.parse(read("manifest.webmanifest")) as {
    name: string;
    icons: { src: string }[];
  };

  test("names the site and points at icons that exist", () => {
    expect(manifest.name).toBe("AndryOre");
    for (const icon of manifest.icons) {
      expect(existsSync(path.join(PUBLIC_ROOT, icon.src))).toBe(true);
    }
  });
});

describe("static brand images", () => {
  test("ships the favicon set and apple-touch-icon", () => {
    for (const file of ["favicon.svg", "favicon.ico", "favicon-32.png", "apple-touch-icon.png"]) {
      expect(existsSync(path.join(PUBLIC_ROOT, file))).toBe(true);
    }
  });

  test("ships one Open Graph image per language within the size budget", () => {
    for (const locale of ["en", "es"]) {
      const size = statSync(path.join(PUBLIC_ROOT, `og/og-${locale}.png`)).size;
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(OG_MAX_BYTES);
    }
  });
});
