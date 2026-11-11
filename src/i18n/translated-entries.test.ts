import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { frontmatterValue, readTranslatedEntries, translationProblems } from "./translated-entries";

describe("frontmatterValue", () => {
  test("reads plain, double-quoted and single-quoted values", () => {
    const frontmatter = "a: plain one\nb: \"say \\\"hi\\\": ok\"\nc: 'it''s'";
    expect(frontmatterValue(frontmatter, "a")).toBe("plain one");
    expect(frontmatterValue(frontmatter, "b")).toBe('say "hi": ok');
    expect(frontmatterValue(frontmatter, "c")).toBe("it's");
  });

  test("returns undefined for an absent key", () => {
    expect(frontmatterValue("a: 1", "b")).toBeUndefined();
  });
});

function withContent(files: Record<string, string>, run: (root: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), "translated-"));
  try {
    for (const [name, text] of Object.entries(files)) {
      const target = path.join(root, "src", "content", name);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const file = (lang: string, title: string, extra = ""): string =>
  `---\nlang: ${lang}\nkey: one\ntitle: "${title}"\n${extra}---\nBody\n`;

describe("readTranslatedEntries", () => {
  test("reads language, key, title, body and hash of Markdown entries", () => {
    withContent(
      {
        "products/en/one.md": file("en", "One"),
        "products/es/uno.md": file("es", "Uno", "sourceHash: abc\n"),
        "chrome.json": "{}",
      },
      (root) => {
        expect(readTranslatedEntries(root)).toEqual([
          {
            id: "src/content/products/en/one.md",
            lang: "en",
            key: "one",
            title: "One",
            body: "Body\n",
          },
          {
            id: "src/content/products/es/uno.md",
            lang: "es",
            key: "one",
            title: "Uno",
            body: "Body\n",
            sourceHash: "abc",
          },
        ]);
      },
    );
  });
});

describe("translationProblems", () => {
  test("flags duplicate titles and changed code blocks", () => {
    withContent(
      {
        "products/en/one.md": `---\nlang: en\nkey: one\ntitle: "T"\n---\n\`\`\`\na\n\`\`\`\n`,
        "products/es/uno.md": `---\nlang: es\nkey: one\ntitle: "T"\n---\n\`\`\`\nb\n\`\`\`\n`,
        "products/en/two.md": file("en", "T").replace("key: one", "key: two"),
      },
      (root) => {
        const problems = translationProblems(root);
        expect(problems.some((line) => line.includes('share the "en" title'))).toBe(true);
        expect(problems.some((line) => line.includes("code blocks differ"))).toBe(true);
      },
    );
  });
});
