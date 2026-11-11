import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { collectHashes, hashSource, metaHashes, pageHashes, renderPolicy } from "./render-csp";

const SCRIPT = "console.log(1)";
const STYLE = "body{margin:0}";

function page(options: { script?: string; style?: string; scripts?: string }) {
  const policy = `script-src 'self' ${options.script ?? ""}; style-src 'self' ${options.style ?? ""};`;
  const scripts = options.scripts ?? `<script>${SCRIPT}</script>`;
  return `<meta http-equiv="content-security-policy" content="${policy}"><style>${STYLE}</style>${scripts}`;
}

describe("hashSource", () => {
  test("hashes the exact text with sha256 and base64", () => {
    expect(hashSource("")).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
  });
});

describe("metaHashes", () => {
  test("reads only the requested directive", () => {
    const html = page({ script: hashSource(SCRIPT), style: hashSource(STYLE) });
    expect([...metaHashes(html, "script-src")]).toEqual([hashSource(SCRIPT)]);
    expect([...metaHashes(html, "style-src")]).toEqual([hashSource(STYLE)]);
  });

  test("is empty without a meta policy", () => {
    expect(metaHashes("<p></p>", "script-src").size).toBe(0);
  });
});

describe("pageHashes", () => {
  test("returns the hashes of executable inline blocks only", () => {
    const html = page({
      script: hashSource(SCRIPT),
      style: hashSource(STYLE),
      scripts: `<script>${SCRIPT}</script><script type="application/ld+json">{}</script><script src="/a.js"></script>`,
    });
    expect(pageHashes(html, "index.html")).toEqual({
      script: [hashSource(SCRIPT)],
      style: [hashSource(STYLE)],
    });
  });

  test("hashes a block whose end tag has trailing whitespace", () => {
    const html = page({
      script: hashSource(SCRIPT),
      style: hashSource(STYLE),
      scripts: `<script>${SCRIPT}</script >`,
    });
    expect(pageHashes(html, "index.html").script).toEqual([hashSource(SCRIPT)]);
  });

  test("fails when an inline script has no hash in its policy", () => {
    expect(() => pageHashes(page({ style: hashSource(STYLE) }), "index.html")).toThrow(
      "inline script",
    );
  });

  test("fails when an inline style has no hash in its policy", () => {
    expect(() => pageHashes(page({ script: hashSource(SCRIPT) }), "index.html")).toThrow(
      "inline style",
    );
  });
});

describe("collectHashes and renderPolicy", () => {
  test("unions the hashes across pages and fills the template", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "render-csp-"));
    try {
      mkdirSync(path.join(directory, "es"));
      const html = page({
        script: hashSource(SCRIPT),
        style: hashSource(STYLE),
      });
      writeFileSync(path.join(directory, "index.html"), html);
      writeFileSync(path.join(directory, "es", "index.html"), html);
      const hashes = collectHashes(directory);
      expect(hashes.script).toEqual([hashSource(SCRIPT)]);
      expect(
        renderPolicy(
          "script-src 'self' __SCRIPT_HASHES__; style-src 'self' __STYLE_HASHES__;",
          hashes,
        ),
      ).toBe(`script-src 'self' ${hashSource(SCRIPT)}; style-src 'self' ${hashSource(STYLE)};`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("the shipped template allows the manifest and no unsafe sources", () => {
    const template = readFileSync(
      path.join(import.meta.dir, "..", "docker", "security-headers.conf.template"),
      "utf8",
    );
    expect(template).toContain("manifest-src 'self';");
    expect(template).not.toContain("unsafe-");
  });

  test("leaves no stray space when there are no hashes", () => {
    expect(
      renderPolicy("style-src 'self' __STYLE_HASHES__;", {
        script: [],
        style: [],
      }),
    ).toBe("style-src 'self';");
  });
});
