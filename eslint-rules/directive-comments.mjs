/**
 * Recognises a directive keyword the way `eslint-plugin-eslint-comments`
 * does: `eslint`, `eslint-env`, `eslint-enable`, `eslint-disable`,
 * `eslint-disable-line`, `eslint-disable-next-line`, `exported`, `global`
 * and `globals`.
 */
const ESLINT_DIRECTIVE_PATTERN =
  /^(eslint(?:-env|-enable|-disable(?:(?:-next)?-line)?)?|exported|globals?)(?:\s|$)/u;

/**
Recognises Oxlint's own disable and enable directive keywords.
 */
const OXLINT_DIRECTIVE_PATTERN = /^(oxlint-(?:enable|disable(?:(?:-next)?-line)?))(?:\s|$)/u;

/**
The only `eslint-*` kinds ESLint honours in a `//` line comment.
 */
const ESLINT_LINE_COMMENT_KIND = /^eslint-disable-(?:next-)?line$/u;

/**
The ` -- ` separator between a directive and its description.
 */
const DESCRIPTION_SEPARATOR = /\s-{2,}\s/u;

/**
A line break inside a block comment.
 */
const LINE_BREAK = /\r\n|[\n\r]/u;

/**
What separates the rule ids a directive lists.
 */
const RULE_ID_DELIMITER = /[\s,]+/u;

/**
 * Splits a comment's text at the first ` -- ` (two or more hyphens with
 * whitespace on both sides) into the directive and its description.
 * @param value The comment's text without its delimiters.
 * @returns The trimmed directive text, and the description or `undefined`.
 */
function divideDirectiveComment(value) {
  const [text = "", ...rest] = value.split(DESCRIPTION_SEPARATOR);
  return {
    text: text.trim(),
    description: rest.length > 0 ? (rest[0] ?? "").trim() : undefined,
  };
}

/**
 * Parses one comment into a directive. `eslint-*` kinds keep ESLint's rule
 * that only `-line`/`-next-line` work in a line comment; `oxlint-*` kinds
 * work in both comment types, as Oxlint honours them there.
 * @param comment An ESLint comment token.
 * @returns `{ kind, value, description, comment }`, where `value` is the text
 *   after the keyword, or `undefined` when the comment is not a directive.
 */
function parseDirectiveComment(comment) {
  const { text, description } = divideDirectiveComment(comment.value);
  const eslintMatch = ESLINT_DIRECTIVE_PATTERN.exec(text);
  const match = eslintMatch ?? OXLINT_DIRECTIVE_PATTERN.exec(text);
  if (!match) return;
  const kind = match[1] ?? "";
  const isIgnoredLineComment =
    Boolean(eslintMatch) && comment.type === "Line" && !ESLINT_LINE_COMMENT_KIND.test(kind);
  const isMultilineDisableLine =
    kind.endsWith("-disable-line") && comment.loc.start.line !== comment.loc.end.line;
  if (isIgnoredLineComment || isMultilineDisableLine) return;
  return {
    kind,
    value: text.slice(kind.length).trim(),
    description,
    comment,
  };
}

/**
 * Lists every directive comment of a file in source order.
 * @param sourceCode The file's `SourceCode`.
 * @returns The parsed directives.
 */
function getDirectiveComments(sourceCode) {
  return sourceCode
    .getAllComments()
    .map((comment) => parseDirectiveComment(comment))
    .filter((directive) => directive !== undefined);
}

/**
 * Reduces a directive kind to the action it takes, without its
 * `eslint-`/`oxlint-` prefix.
 * @param kind A directive keyword such as `eslint-disable-next-line`.
 * @returns `disable`, `enable`, `disable-line` or `disable-next-line`, or
 *   `undefined` for a kind that neither disables nor enables rules.
 */
function disableKind(kind) {
  const match = /^(?:eslint|oxlint)-((?:disable|enable)(?:-next)?(?:-line)?)$/u.exec(kind);
  return match ? match[1] : undefined;
}

/**
 * Replays a file's disable and enable directives the way the original
 * plugin's `DisabledArea` does. A line-scoped disable (`-line`/`-next-line`)
 * is closed by itself, so a block enable never consumes it.
 * @param sourceCode The file's `SourceCode`.
 * @returns The block areas left open (`{ comment, ruleId }`), the enables that
 *   closed nothing (`{ comment, ruleId }`, `ruleId: undefined` for a bare one),
 *   and, per enable comment, how many disable comments it closed.
 */
function replayDisabledAreas(sourceCode) {
  const areas = [];
  const unusedEnables = [];
  const relatedDisableCounts = new Map();

  const disable = (comment, ruleIds, scope) => {
    const targets = ruleIds ?? [undefined];
    for (const ruleId of targets) {
      areas.push({ comment, ruleId, scope, isOpen: true });
    }
  };

  const enable = (comment, ruleIds, scope) => {
    const related = new Set();
    const targets = ruleIds ?? [undefined];
    for (const ruleId of targets) {
      const closed = areas.filter(
        (area) =>
          area.isOpen && area.scope === scope && (ruleIds === undefined || area.ruleId === ruleId),
      );
      for (const area of closed) {
        area.isOpen = false;
        related.add(area.comment);
      }
      if (closed.length === 0) unusedEnables.push({ comment, ruleId });
    }
    relatedDisableCounts.set(comment, related.size);
  };

  for (const directive of getDirectiveComments(sourceCode)) {
    const type = disableKind(directive.kind);
    if (type === undefined) continue;
    const ruleIds = directive.value ? directive.value.split(RULE_ID_DELIMITER) : undefined;
    if (type === "disable") {
      disable(directive.comment, ruleIds, "block");
    } else if (type === "enable") {
      enable(directive.comment, ruleIds, "block");
    } else {
      disable(directive.comment, ruleIds, "line");
      enable(directive.comment, ruleIds, "line");
    }
  }
  return {
    openAreas: areas.filter((area) => area.isOpen),
    unusedEnables,
    relatedDisableCounts,
  };
}

/**
 * Locates a rule id inside a directive comment, so a report points at the
 * id itself.
 * @param comment The directive comment token.
 * @param ruleId The rule id to find, or `undefined` for the whole comment.
 * @returns The id's location, or the comment's when the id is `undefined` or
 *   not found.
 */
function ruleIdLocation(comment, ruleId) {
  if (ruleId === undefined) return comment.loc;
  const lines = comment.value.split(LINE_BREAK);
  const escaped = ruleId.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
  const ruleIdPattern = new RegExp(String.raw`([\s,]|^)${escaped}(?:[\s,]|$)`, "u");
  for (const [index, line] of lines.entries()) {
    const match = ruleIdPattern.exec(line);
    if (!match) continue;
    const offset = match.index + (match[1] ?? "").length;
    const column = index === 0 ? 2 + comment.loc.start.column + offset : offset;
    const lineNumber = comment.loc.start.line + index;
    return {
      start: { line: lineNumber, column },
      end: { line: lineNumber, column: column + ruleId.length },
    };
  }
  return comment.loc;
}

/**
 * Builds a rule that reports once per item a scan of the file returns.
 * @param meta Type, docs and messages; an empty `schema` is added.
 * @param findReports Returns `{ loc, messageId, data? }` reports for a
 *   file's `SourceCode`.
 * @returns The rule module.
 */
function createDirectiveRule(meta, findReports) {
  return {
    meta: { schema: [], ...meta },
    create(context) {
      return {
        Program() {
          for (const report of findReports(context.sourceCode)) {
            context.report(report);
          }
        },
      };
    },
  };
}

/**
 * Port of `@eslint-community/eslint-comments/require-description`: every
 * directive comment (`eslint-disable*`, `eslint-enable`, `eslint`,
 * `eslint-env`, `exported`, `global(s)` and the `oxlint-*` kinds) needs a
 * ` -- description`.
 */
export const requireDescription = createDirectiveRule(
  {
    type: "suggestion",
    docs: { description: "Require a description on every directive comment." },
    messages: {
      missingDescription:
        "Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.",
    },
  },
  (sourceCode) =>
    getDirectiveComments(sourceCode)
      .filter((directive) => !directive.description)
      .map((directive) => ({
        loc: directive.comment.loc,
        messageId: "missingDescription",
      })),
);

/**
 * Port of `@eslint-community/eslint-comments/no-unlimited-disable`: a disable
 * directive must name the rules it silences.
 */
export const noUnlimitedDisable = createDirectiveRule(
  {
    type: "suggestion",
    docs: { description: "Disallow disable directives without rule names." },
    messages: {
      unexpected: "Unexpected unlimited '{{kind}}' comment. Specify some rule names to disable.",
    },
  },
  (sourceCode) =>
    getDirectiveComments(sourceCode)
      .filter((directive) => {
        const type = disableKind(directive.kind);
        return type !== undefined && type !== "enable" && !directive.value;
      })
      .map((directive) => ({
        loc: directive.comment.loc,
        messageId: "unexpected",
        data: { kind: directive.kind },
      })),
);

/**
 * Port of `@eslint-community/eslint-comments/no-unused-enable`: an enable
 * directive must re-enable something an earlier block disable turned off.
 */
export const noUnusedEnable = createDirectiveRule(
  {
    type: "problem",
    docs: { description: "Disallow enable directives that re-enable nothing." },
    messages: {
      unused: "ESLint rules are re-enabled but those have not been disabled.",
      unusedRule: "'{{ruleId}}' rule is re-enabled but it has not been disabled.",
    },
  },
  (sourceCode) =>
    replayDisabledAreas(sourceCode).unusedEnables.map((item) => ({
      loc: ruleIdLocation(item.comment, item.ruleId),
      messageId: item.ruleId === undefined ? "unused" : "unusedRule",
      data: { ruleId: item.ruleId ?? "" },
    })),
);

/**
 * Port of `@eslint-community/eslint-comments/no-aggregating-enable`: one
 * enable directive must not close several disable directives.
 */
export const noAggregatingEnable = createDirectiveRule(
  {
    type: "suggestion",
    docs: {
      description: "Disallow an enable directive that closes several disable directives.",
    },
    messages: {
      aggregatingEnable:
        "This `eslint-enable` comment affects {{count}} `eslint-disable` comments. An `eslint-enable` comment should be for an `eslint-disable` comment.",
    },
  },
  (sourceCode) =>
    [...replayDisabledAreas(sourceCode).relatedDisableCounts]
      .filter(([, count]) => count >= 2)
      .map(([comment, count]) => ({
        loc: comment.loc,
        messageId: "aggregatingEnable",
        data: { count: String(count) },
      })),
);

/**
 * Port of `@eslint-community/eslint-comments/disable-enable-pair` without
 * options: every block disable directive needs a matching enable.
 */
export const disableEnablePair = createDirectiveRule(
  {
    type: "suggestion",
    docs: {
      description: "Require an enable directive for every block disable.",
    },
    messages: {
      missingPair: "Requires 'eslint-enable' directive.",
      missingRulePair: "Requires 'eslint-enable' directive for '{{ruleId}}'.",
    },
  },
  (sourceCode) =>
    replayDisabledAreas(sourceCode).openAreas.map((area) => ({
      loc: ruleIdLocation(area.comment, area.ruleId),
      messageId: area.ruleId === undefined ? "missingPair" : "missingRulePair",
      data: { ruleId: area.ruleId ?? "" },
    })),
);
