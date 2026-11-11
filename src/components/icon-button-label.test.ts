import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const COMPONENTS_ROOT = import.meta.dir;
const ICON_SIZES = new Set(["icon", "dock"]);
const NAME_ATTRIBUTES = new Set(["aria-label", "aria-labelledby"]);

function listIslands(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => path.join(directory, file));
}

function attributeName(attribute: ts.JsxAttributeLike): string | undefined {
  return ts.isJsxAttribute(attribute) ? attribute.name.getText() : undefined;
}

function isIconSize(attribute: ts.JsxAttributeLike): boolean {
  if (!ts.isJsxAttribute(attribute) || attributeName(attribute) !== "size") {
    return false;
  }
  const initializer = attribute.initializer;
  return (
    initializer !== undefined && ts.isStringLiteral(initializer) && ICON_SIZES.has(initializer.text)
  );
}

/**
 * Finds icon-only `Button` elements that carry no accessible name, which
 * `jsx-a11y` cannot see on a custom component.
 * @param fileName Name used for the parsed source.
 * @param source TSX source text.
 * @returns One `file:line` per unlabelled icon button.
 */
function findUnlabelledIconButtons(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === "Button"
    ) {
      const attributes = node.attributes.properties;
      const named = attributes.some((attribute) =>
        NAME_ATTRIBUTES.has(attributeName(attribute) ?? ""),
      );
      if (!named && attributes.some((attribute) => isIconSize(attribute))) {
        const { line } = file.getLineAndCharacterOfPosition(node.getStart());
        problems.push(`${fileName}:${String(line + 1)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return problems;
}

describe("findUnlabelledIconButtons", () => {
  test("flags an icon button without a name", () => {
    expect(findUnlabelledIconButtons("a.tsx", '<Button size="icon"><svg /></Button>')).toEqual([
      "a.tsx:1",
    ]);
    expect(findUnlabelledIconButtons("a.tsx", '<Button size="dock" />')).toEqual(["a.tsx:1"]);
  });

  test("accepts a labelled icon button and ignores text buttons", () => {
    expect(findUnlabelledIconButtons("a.tsx", '<Button size="icon" aria-label="Close" />')).toEqual(
      [],
    );
    expect(findUnlabelledIconButtons("a.tsx", "<Button>Save</Button>")).toEqual([]);
  });
});

describe("islands", () => {
  test("every icon-only Button has an accessible name", () => {
    const problems = listIslands(COMPONENTS_ROOT).flatMap((file) =>
      findUnlabelledIconButtons(path.relative(COMPONENTS_ROOT, file), readFileSync(file, "utf8")),
    );
    expect(problems).toEqual([]);
  });
});
