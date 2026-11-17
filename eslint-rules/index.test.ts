import { expect, test } from "bun:test";

import localPlugin from "./index.mjs";
import rule from "./no-non-document-comments.mjs";
import { noBunTestOnly, noUnawaitedAsyncMatcher } from "./test-integrity.mjs";

test("the local plugin registers the no-non-doc-comments rule", () => {
  expect(localPlugin.rules["no-non-doc-comments"]).toBe(rule);
});

test("the local plugin registers the baseline test-integrity rules", () => {
  expect(localPlugin.rules["no-unawaited-async-matcher"]).toBe(noUnawaitedAsyncMatcher);
  expect(localPlugin.rules["no-bun-test-only"]).toBe(noBunTestOnly);
});
