import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";

import { CONTACT_EMAIL, copyWithFallback, CV_PATHS } from "./contact";

describe("copyWithFallback", () => {
  test("reports copied when the clipboard accepts the text", async () => {
    const written: string[] = [];
    const outcome = await copyWithFallback("a@b.c", {
      writeText: (text) => {
        written.push(text);
        return Promise.resolve();
      },
      selectText: () => {
        throw new Error("should not select");
      },
    });
    expect(outcome).toBe("copied");
    expect(written).toEqual(["a@b.c"]);
  });

  test("selects the text when the clipboard rejects", async () => {
    let selected = 0;
    const outcome = await copyWithFallback("a@b.c", {
      writeText: () => Promise.reject(new Error("denied")),
      selectText: () => {
        selected += 1;
      },
    });
    expect(outcome).toBe("selected");
    expect(selected).toBe(1);
  });

  test("selects the text when there is no clipboard", async () => {
    let selected = 0;
    const outcome = await copyWithFallback("a@b.c", {
      selectText: () => {
        selected += 1;
      },
    });
    expect(outcome).toBe("selected");
    expect(selected).toBe(1);
  });
});

describe("contact constants", () => {
  test("the email is a plain address and never a mailto link", () => {
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+$/);
    expect(CONTACT_EMAIL.startsWith("mailto:")).toBe(false);
    expect(CONTACT_EMAIL).toBe("hello@andryore.dev");
  });

  test("each CV path is a language-named pdf under /cv/", () => {
    expect(CV_PATHS.en).toMatch(/^\/cv\/.+-en\.pdf$/);
    expect(CV_PATHS.es).toMatch(/^\/cv\/.+-es\.pdf$/);
  });

  const publicDirectory = path.join(import.meta.dir, "../../public");

  test("both CV PDFs exist as committed assets", () => {
    for (const cvPath of Object.values(CV_PATHS)) {
      expect(existsSync(path.join(publicDirectory, cvPath))).toBe(true);
    }
  });
});
