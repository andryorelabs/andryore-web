import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { auditCss, auditDirectory, auditHtml } from "./audit-distribution";

describe("auditHtml", () => {
  test("accepts same-site resources and the Umami origins", () => {
    const html = `
      <link rel="stylesheet" href="/_astro/a.css">
      <link rel="canonical" href="https://elsewhere.example/">
      <script src="https://cloud.umami.is/script.js"></script>
      <img src="/memoji.webp">`;
    expect(auditHtml(html)).toEqual([]);
  });

  test("flags a third-party script, image and stylesheet", () => {
    const html = `
      <script src="https://cdn.example/x.js"></script>
      <img src="//tracker.example/p.gif">
      <link rel="stylesheet" href="https://fonts.example/f.css">`;
    expect(auditHtml(html)).toHaveLength(3);
  });

  test("requires noopener noreferrer on external anchors only", () => {
    const html = `
      <a href="https://github.com/AndryOre">x</a>
      <a href="https://github.com/AndryOre" rel="noopener noreferrer">y</a>
      <a href="/about/">z</a>
      <a href="https://andryore.dev/about/">w</a>`;
    expect(auditHtml(html)).toEqual([
      "external link without noopener noreferrer: https://github.com/AndryOre",
      'external link without target="_blank": https://github.com/AndryOre',
      'external link without target="_blank": https://github.com/AndryOre',
    ]);
  });

  test('requires target="_blank" on cross-origin http(s) anchors', () => {
    const safe = 'rel="noopener noreferrer"';
    const html = `
      <a href="https://github.com/AndryOre" ${safe}>x</a>
      <a href="//other.example/" ${safe} target="_self">y</a>
      <a href="https://github.com/AndryOre" ${safe} target="_blank">ok</a>
      <a href="mailto:hi@andryore.dev">mail</a>
      <a href="/about/">local</a>`;
    expect(auditHtml(html)).toEqual([
      'external link without target="_blank": https://github.com/AndryOre',
      'external link without target="_blank": //other.example/',
    ]);
  });
});

describe("auditCss", () => {
  test("flags remote url() and @import", () => {
    const css = `a{background:url(https://x.example/a.png)} @import "https://y.example/b.css"; b{background:url(/local.png)}`;
    expect(auditCss(css)).toHaveLength(2);
  });
});

describe("auditDirectory", () => {
  test("prefixes each problem with its file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "audit-dist-"));
    try {
      mkdirSync(path.join(root, "a"));
      writeFileSync(
        path.join(root, "a", "index.html"),
        '<script src="https://cdn.example/x.js"></script>',
      );
      writeFileSync(path.join(root, "ok.css"), "a{color:red}");
      expect(auditDirectory(root)).toEqual([
        "a/index.html: third-party request in <script>: https://cdn.example/x.js",
      ]);
    } finally {
      rmSync(root, { recursive: true });
    }
  });
});
