import { expect, test } from "bun:test";

import localPlugin from "./index.mjs";
import rule from "./no-non-document-comments.mjs";

test("the local plugin registers the no-non-doc-comments rule", () => {
  expect(localPlugin.rules["no-non-doc-comments"]).toBe(rule);
});
