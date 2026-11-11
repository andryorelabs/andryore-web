/**
 * Flags an un-awaited `.rejects`/`.resolves` matcher statement. bun-types types
 * them as synchronous, so `no-floating-promises` cannot see the missing
 * `await` and a failing assertion would never be reported.
 */
export const UNAWAITED_ASYNC_MATCHER_SELECTORS = [
  `ExpressionStatement > CallExpression[callee.object.property.name=/^(rejects|resolves)$/]`,
  `ExpressionStatement > CallExpression[callee.object.object.property.name=/^(rejects|resolves)$/]`,
].map((selector) => ({
  selector,
  message:
    "bun-types types `.rejects`/`.resolves` as synchronous matchers, so `@typescript-eslint/no-floating-promises` can't see an un-awaited one and a failing assertion is never reported. Prefix the statement with `await` or return it.",
}));

/**
 * `shadcn/no-restyle` contracts: one entry per real, bounded design decision
 * about a component's `className`. Empty until the first shadcn/ui component
 * lands; add entries here, never a file-wide disable.
 */
export const shadcnNoRestyleContracts = [];
