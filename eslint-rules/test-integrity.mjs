/**
 * Member names that turn an `expect(...)` call into an async assertion.
 */
const ASYNC_MATCHER_MODIFIERS = new Set(["rejects", "resolves"]);

/**
 * `bun:test` functions that accept a `.only` modifier.
 */
const FOCUSABLE_TEST_FUNCTIONS = new Set(["test", "it", "describe"]);

/**
 * The property name of a member access, for both `.name` and `["name"]`.
 * @param node A `MemberExpression`.
 * @returns The accessed name, or `undefined` when it is computed at runtime.
 */
function memberName(node) {
  const property = node.property;
  if (node.computed !== true) {
    return property?.type === "Identifier" ? property.name : undefined;
  }
  return typeof property?.value === "string" ? property.value : undefined;
}

/**
 * Whether the member chain below `node` goes through `expect(...).rejects`
 * or `expect(...).resolves`.
 * @param node The callee of a call expression.
 * @returns Whether the call is an async assertion.
 */
function startsAsyncMatcherChain(node) {
  let current = node;
  while (current?.type === "MemberExpression") {
    if (ASYNC_MATCHER_MODIFIERS.has(memberName(current) ?? "")) {
      const expectCall = current.object;
      return (
        expectCall?.type === "CallExpression" &&
        expectCall.callee?.type === "Identifier" &&
        expectCall.callee.name === "expect"
      );
    }
    current = current.object;
  }
  return false;
}

/**
 * Whether a promise produced at `node` is awaited or handed back to the caller.
 * @param node A call expression.
 * @returns Whether the promise reaches an `await` or a `return`.
 */
function isAwaitedOrReturned(node) {
  const parent = node.parent;
  return (
    parent.type === "AwaitExpression" ||
    parent.type === "ReturnStatement" ||
    (parent.type === "ArrowFunctionExpression" && parent.body === node)
  );
}

/**
 * Requires `expect(...).rejects` and `.resolves` assertions to be awaited or
 * returned. bun-types types them as synchronous, so `no-floating-promises`
 * cannot see a missing `await` and a failing assertion would be lost.
 */
export const noUnawaitedAsyncMatcher = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `expect(...).rejects` and `.resolves` assertions to be awaited or returned.",
    },
    messages: {
      unawaited:
        "This async assertion is never awaited, so a failure is silently lost. `await` it or `return` it.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (startsAsyncMatcherChain(node.callee) && !isAwaitedOrReturned(node)) {
          context.report({ node, messageId: "unawaited" });
        }
      },
    };
  },
};

/**
 * The name an import specifier imports, for both `{ test }` and
 * `{ "test" as run }`.
 * @param specifier An `ImportSpecifier`.
 * @returns The `Identifier` name, or the string literal's value.
 */
function importedName(specifier) {
  const imported = specifier.imported;
  return imported.type === "Identifier" ? imported.name : imported.value;
}

/**
 * Records the local bindings of the focusable functions and of the
 * namespace that one import declaration takes from `bun:test`.
 * @param declaration An `ImportDeclaration`.
 * @param functionNames Collects local names of `test`, `it` and `describe`.
 * @param namespaceNames Collects local names of `import * as` bindings.
 */
function collectBunTestBindings(declaration, functionNames, namespaceNames) {
  if (declaration.source.value !== "bun:test") return;
  for (const specifier of declaration.specifiers) {
    if (specifier.type === "ImportNamespaceSpecifier") {
      namespaceNames.add(specifier.local.name);
    } else if (
      specifier.type === "ImportSpecifier" &&
      FOCUSABLE_TEST_FUNCTIONS.has(importedName(specifier))
    ) {
      functionNames.add(specifier.local.name);
    }
  }
}

/**
 * Whether `node` names a focusable function imported from `bun:test`, either
 * directly (`test`) or through a namespace import (`bun.test`).
 * @param node The object of a `.only` member access.
 * @param functionNames Local names of the imported focusable functions.
 * @param namespaceNames Local names of `bun:test` namespace imports.
 * @returns Whether `.only` would focus a `bun:test` test.
 */
function isBunTestFunction(node, functionNames, namespaceNames) {
  return node.type === "Identifier"
    ? functionNames.has(node.name)
    : node.type === "MemberExpression" &&
        node.object.type === "Identifier" &&
        namespaceNames.has(node.object.name) &&
        FOCUSABLE_TEST_FUNCTIONS.has(memberName(node) ?? "");
}

/**
 * Rejects `.only` on `test`, `it` and `describe` imported from `bun:test`,
 * which `jest/no-focused-tests` does not see.
 */
export const noBunTestOnly = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `.only` on `test`, `it` and `describe` imported from `bun:test`.",
    },
    messages: {
      focused:
        "A focused test skips every other test in the run. Remove `.only` before committing.",
    },
    schema: [],
  },
  create(context) {
    const functionNames = new Set();
    const namespaceNames = new Set();
    return {
      ImportDeclaration(node) {
        collectBunTestBindings(node, functionNames, namespaceNames);
      },
      MemberExpression(node) {
        if (
          memberName(node) === "only" &&
          isBunTestFunction(node.object, functionNames, namespaceNames)
        ) {
          context.report({ node, messageId: "focused" });
        }
      },
    };
  },
};
