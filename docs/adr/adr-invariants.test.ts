import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ADR_DIRECTORY = import.meta.dir;
const ADR_FILE_PATTERN = /^(\d{4})-[\da-z-]+\.md$/;
const ALLOWED_STATUSES = /^(Accepted|Proposed|Deprecated|Superseded)\b/;
const NOT_YET_IMPLEMENTED_STATUS = /^Accepted — not yet implemented\b/;
const DATE_LINE_PATTERN = /^Date: \d{4}-\d{2}-\d{2}$/m;
const RELATION_PHRASE_SOURCE = String.raw`Amended\s+by|Partly\s+superseded\s+by|Superseded\s+by|Amends|Extends|Partly\s+supersedes|Supersedes`;
const RELATION_PHRASE_PATTERN = new RegExp(String.raw`\b(?:${RELATION_PHRASE_SOURCE})\b`, "g");
const RELATION_WITH_LINK_PATTERN = new RegExp(
  String.raw`\b(?:${RELATION_PHRASE_SOURCE})\s+\[\d{4}\]\(\d{4}-[^)]+\.md\)`,
  "g",
);
const RELATION_LIST_PATTERN = new RegExp(
  String.raw`\b(${RELATION_PHRASE_SOURCE})\s+((?:\[\d{4}\]\([^)]+\)(?:,?\s+(?:and\s+)?)?)+)`,
  "g",
);
const RELATION_LINK_PATTERN = /\[(\d{4})\]\(([^)]+)\)/g;
const VALID_REVISED_LINE_PATTERN = /^Revised: \d{4}-\d{2}-\d{2}, \S/;
const INDEX_ROW_PATTERN = /^\|\s*(\d{4})\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|[^|]*\|([^|]*)\|\s*$/gm;

const RELATION_KINDS = {
  Amends: { inverse: "Amended by", partly: false },
  Extends: { inverse: "Amended by", partly: false },
  "Partly supersedes": { inverse: "Partly superseded by", partly: true },
  Supersedes: { inverse: "Superseded by", partly: false },
} as const;

type ForwardPhrase = keyof typeof RELATION_KINDS;
type InversePhrase = (typeof RELATION_KINDS)[ForwardPhrase]["inverse"];
type RelationPhrase = ForwardPhrase | InversePhrase;

interface Relation {
  readonly phrase: RelationPhrase;
  readonly targetNumber: string;
  readonly targetFile: string;
}

interface IndexRow {
  readonly number: string;
  readonly title: string;
  readonly fileName: string;
  readonly supersededOrAmendedBy: string;
}

function isForwardPhrase(phrase: string): phrase is ForwardPhrase {
  return Object.hasOwn(RELATION_KINDS, phrase);
}

/**
 * Reads every relation phrase of a Status section, expanding lists such as
 * "Amends [0002](...) and [0003](...)" into one relation per linked ADR.
 * @param statusSection - The text under the Status heading.
 * @returns The relations in reading order.
 */
function parseRelations(statusSection: string): Relation[] {
  return statusSection
    .matchAll(RELATION_LIST_PATTERN)
    .flatMap((listMatch) =>
      (listMatch[2] ?? "").matchAll(RELATION_LINK_PATTERN).map((link): Relation => ({
        phrase: (listMatch[1] ?? "").replaceAll(/\s+/g, " ") as RelationPhrase,
        targetNumber: link[1] ?? "",
        targetFile: link[2] ?? "",
      })),
    )
    .toArray();
}

function readStatusSection(content: string): string {
  return /(?:^|\n)## Status\n\n([\s\S]*?)(?=\n## |$)/.exec(content)?.[1] ?? "";
}

/**
 * Reads the README table rows of the ADR index.
 * @param indexContent - The contents of the ADR index README.
 * @returns One row per ADR listed in the table.
 */
function parseIndexRows(indexContent: string): IndexRow[] {
  return Array.from(indexContent.matchAll(INDEX_ROW_PATTERN), (match): IndexRow => ({
    number: match[1] ?? "",
    title: match[2] ?? "",
    fileName: match[3] ?? "",
    supersededOrAmendedBy: (match[4] ?? "").trim(),
  }));
}

/**
 * Builds the expected "Superseded or amended by" cell from the ADR's own
 * reverse relations.
 * @param relations - The relations read from the ADR's Status.
 * @returns The cell text, "-" when there are none.
 */
function expectedIndexCell(relations: readonly Relation[]): string {
  const entries = relations
    .filter((relation) => !isForwardPhrase(relation.phrase))
    .toSorted((left, right) => left.targetNumber.localeCompare(right.targetNumber))
    .map(
      (relation) =>
        `${relation.targetNumber}${relation.phrase === "Partly superseded by" ? " (partly)" : ""}`,
    );
  return entries.length > 0 ? entries.join(", ") : "-";
}

function findRelationViolations(adrs: readonly AdrFile[]): string[] {
  const violations: string[] = [];
  const byFile = new Map(adrs.map((adr) => [adr.fileName, adr]));
  const relationsByFile = new Map(
    adrs.map((adr) => [adr.fileName, parseRelations(readStatusSection(adr.content))]),
  );
  for (const adr of adrs) {
    const relations = relationsByFile.get(adr.fileName) ?? [];
    for (const relation of relations) {
      const target = byFile.get(relation.targetFile);
      if (!target || !relation.targetFile.startsWith(`${relation.targetNumber}-`)) {
        violations.push(
          `${adr.fileName}: "${relation.phrase}" links missing ADR ${relation.targetFile}`,
        );
        continue;
      }
      const inverse = isForwardPhrase(relation.phrase)
        ? RELATION_KINDS[relation.phrase].inverse
        : undefined;
      const mirrored = (relationsByFile.get(target.fileName) ?? []).some(
        (other) =>
          other.targetFile === adr.fileName &&
          (inverse
            ? other.phrase === inverse
            : isForwardPhrase(other.phrase) &&
              RELATION_KINDS[other.phrase].inverse === relation.phrase),
      );
      if (!mirrored) {
        violations.push(
          `${adr.fileName}: "${relation.phrase}" ${target.number} is not recorded on ${target.fileName}`,
        );
      }
    }
  }
  return violations;
}

function findIndexViolations(adrs: readonly AdrFile[], indexContent: string): string[] {
  const violations: string[] = [];
  const rowsByFile = new Map(parseIndexRows(indexContent).map((row) => [row.fileName, row]));
  for (const adr of adrs) {
    const row = rowsByFile.get(adr.fileName);
    if (!row) continue;
    const title = /^# \d{4}: (.*)$/m.exec(adr.content)?.[1]?.trim() ?? "";
    if (row.title !== title) {
      violations.push(`${adr.fileName}: README title "${row.title}" differs from "${title}"`);
    }
    const expected = expectedIndexCell(parseRelations(readStatusSection(adr.content)));
    if (row.supersededOrAmendedBy !== expected) {
      violations.push(
        `${adr.fileName}: README "Superseded or amended by" is "${row.supersededOrAmendedBy}", expected "${expected}"`,
      );
    }
  }
  return violations;
}

interface AdrFile {
  readonly fileName: string;
  readonly number: string;
  readonly content: string;
}

/**
 * Checks a set of ADRs against the repo invariants and returns one message per
 * violation. Pure so the fixtures below can exercise every rule.
 * @param adrs - The ADR files to check.
 * @param indexContent - The contents of the ADR index README.
 * @returns One message per violation, empty when all invariants hold.
 */
function findAdrViolations(adrs: readonly AdrFile[], indexContent: string): string[] {
  const violations: string[] = [];
  const numbers = adrs.map((adr) => Number(adr.number));

  if (new Set(numbers).size !== numbers.length) {
    violations.push("duplicate ADR number");
  }
  if (numbers.some((number, index) => index > 0 && number < (numbers[index - 1] ?? 0))) {
    violations.push("ADR numbers are not ascending");
  }

  for (const adr of adrs) {
    const firstLine = adr.content.split("\n", 1)[0] ?? "";
    if (!new RegExp(String.raw`^# ${adr.number}: \S.*$`).test(firstLine)) {
      violations.push(`${adr.fileName}: bad header`);
    }
    const statusSection = readStatusSection(adr.content);
    const status = statusSection.split("\n", 1)[0] ?? "";
    const hasDash = status.startsWith("Accepted —");
    if (!ALLOWED_STATUSES.test(status) || (hasDash && !NOT_YET_IMPLEMENTED_STATUS.test(status))) {
      violations.push(`${adr.fileName}: unknown status "${status}"`);
    }
    if (!DATE_LINE_PATTERN.test(statusSection)) {
      violations.push(`${adr.fileName}: missing Date line in Status`);
    }
    const phraseCount = statusSection.match(RELATION_PHRASE_PATTERN)?.length ?? 0;
    const linkedCount = statusSection.match(RELATION_WITH_LINK_PATTERN)?.length ?? 0;
    if (phraseCount !== linkedCount) {
      violations.push(`${adr.fileName}: relation wording must link the ADR number`);
    }
    const revisedLines = statusSection.split("\n").filter((line) => line.startsWith("Revised:"));
    if (revisedLines.some((line) => !VALID_REVISED_LINE_PATTERN.test(line))) {
      violations.push(`${adr.fileName}: Revised line must be "Revised: YYYY-MM-DD, <text>"`);
    }
    if (!indexContent.includes(`](${adr.fileName})`)) {
      violations.push(`${adr.fileName}: not listed in README`);
    }
  }

  const linked = Array.from(
    indexContent.matchAll(/\]\((\d{4}-[^)]+\.md)\)/g),
    (match) => match[1] ?? "",
  );
  const known = new Set(adrs.map((adr) => adr.fileName));
  for (const fileName of linked) {
    if (!known.has(fileName)) {
      violations.push(`${fileName}: listed in README but missing`);
    }
  }

  violations.push(...findRelationViolations(adrs), ...findIndexViolations(adrs, indexContent));

  return violations;
}

function readAdrs(): AdrFile[] {
  return readdirSync(ADR_DIRECTORY)
    .filter((fileName) => ADR_FILE_PATTERN.test(fileName))
    .toSorted((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      fileName,
      number: ADR_FILE_PATTERN.exec(fileName)?.[1] ?? "",
      content: readFileSync(path.join(ADR_DIRECTORY, fileName), "utf8"),
    }));
}

function fixtureRow(title: string, cell: string): string {
  return `| 0001 | [${title}](0001-fixture.md) | Accepted | ${cell} |`;
}

function fixtureAdr(number: string, status = "Accepted"): AdrFile {
  return {
    fileName: `${number}-fixture.md`,
    number,
    content: `# ${number}: Fixture\n\n## Status\n\n${status}\n\nDate: 2026-10-17\n\n## Context\n`,
  };
}

describe("ADR invariants", () => {
  it("holds for the real ADRs", () => {
    const adrs = readAdrs();
    expect(adrs.length).toBeGreaterThan(0);
    const indexContent = readFileSync(path.join(ADR_DIRECTORY, "README.md"), "utf8");
    expect(findAdrViolations(adrs, indexContent)).toEqual([]);
  });
});

describe("findAdrViolations", () => {
  const index = "[a](0001-fixture.md) [b](0002-fixture.md)";

  it("accepts a valid set", () => {
    expect(findAdrViolations([fixtureAdr("0001"), fixtureAdr("0002")], index)).toEqual([]);
  });

  it("flags a duplicate number", () => {
    const violations = findAdrViolations([fixtureAdr("0001"), fixtureAdr("0001")], index);
    expect(violations).toContain("duplicate ADR number");
  });

  it("flags an unknown status", () => {
    const violations = findAdrViolations([fixtureAdr("0001", "Maybe")], index);
    expect(violations).toContain('0001-fixture.md: unknown status "Maybe"');
  });

  it("accepts the not-yet-implemented status", () => {
    expect(
      findAdrViolations(
        [fixtureAdr("0001", "Accepted — not yet implemented")],
        "[a](0001-fixture.md)",
      ),
    ).toEqual([]);
  });

  it("flags a malformed dashed status", () => {
    const violations = findAdrViolations([fixtureAdr("0001", "Accepted — someday")], index);
    expect(violations).toContain('0001-fixture.md: unknown status "Accepted — someday"');
  });

  it("flags a missing or malformed Date line", () => {
    const missing: AdrFile = {
      ...fixtureAdr("0001"),
      content: "# 0001: Fixture\n\n## Status\n\nAccepted\n\n## Context\n",
    };
    const malformed: AdrFile = {
      ...fixtureAdr("0002"),
      content: fixtureAdr("0002").content.replace("2026-10-17", "today"),
    };
    const violations = findAdrViolations([missing, malformed], index);
    expect(violations).toContain("0001-fixture.md: missing Date line in Status");
    expect(violations).toContain("0002-fixture.md: missing Date line in Status");
  });

  it("accepts linked relation wording, wrapped across lines", () => {
    const status =
      "Accepted. Amended by\n[0002](0002-fixture.md): reason. Partly superseded by [0003](0003-fixture.md).";
    const adrs = [
      fixtureAdr("0001", status),
      fixtureAdr("0002", "Accepted. Amends [0001](0001-fixture.md)."),
      fixtureAdr("0003", "Accepted. Partly supersedes [0001](0001-fixture.md)."),
    ];
    expect(
      findAdrViolations(adrs, "[a](0001-fixture.md) [b](0002-fixture.md) [c](0003-fixture.md)"),
    ).toEqual([]);
  });

  it("flags a one-sided relation", () => {
    const adrs = [
      fixtureAdr("0001"),
      fixtureAdr("0002", "Accepted. Extends [0001](0001-fixture.md)."),
    ];
    expect(findAdrViolations(adrs, index)).toContain(
      '0002-fixture.md: "Extends" 0001 is not recorded on 0001-fixture.md',
    );
  });

  it('flags a "by" relation the other side does not record', () => {
    const adrs = [
      fixtureAdr("0001", "Accepted. Superseded by [0002](0002-fixture.md)."),
      fixtureAdr("0002"),
    ];
    expect(findAdrViolations(adrs, index)).toContain(
      '0001-fixture.md: "Superseded by" 0002 is not recorded on 0002-fixture.md',
    );
  });

  it("flags a relation that links a missing ADR", () => {
    const adrs = [fixtureAdr("0001", "Accepted. Amends [0009](0009-fixture.md).")];
    expect(findAdrViolations(adrs, "[a](0001-fixture.md)")).toContain(
      '0001-fixture.md: "Amends" links missing ADR 0009-fixture.md',
    );
  });

  it("flags a malformed Revised line", () => {
    const adr: AdrFile = {
      ...fixtureAdr("0001"),
      content: fixtureAdr("0001").content.replace(
        "Date: 2026-10-17\n",
        "Date: 2026-10-17\n\nRevised: yesterday\n",
      ),
    };
    expect(findAdrViolations([adr], "[a](0001-fixture.md)")).toContain(
      '0001-fixture.md: Revised line must be "Revised: YYYY-MM-DD, <text>"',
    );
  });

  it("accepts a well-formed Revised line", () => {
    const adr: AdrFile = {
      ...fixtureAdr("0001"),
      content: fixtureAdr("0001").content.replace(
        "Date: 2026-10-17\n",
        "Date: 2026-10-17\n\nRevised: 2026-10-19, fixed a fact.\n",
      ),
    };
    expect(findAdrViolations([adr], "[a](0001-fixture.md)")).toEqual([]);
  });

  describe("README table", () => {
    it("accepts a matching row", () => {
      expect(findAdrViolations([fixtureAdr("0001")], fixtureRow("Fixture", "-"))).toEqual([]);
    });

    it("reads rows padded by Prettier", () => {
      const paddedRow =
        "| 0001   | [Other](0001-fixture.md)                  | Accepted | -             |";
      expect(findAdrViolations([fixtureAdr("0001")], paddedRow)).toContain(
        '0001-fixture.md: README title "Other" differs from "Fixture"',
      );
    });

    it("flags a title mismatch", () => {
      expect(findAdrViolations([fixtureAdr("0001")], fixtureRow("Other", "-"))).toContain(
        '0001-fixture.md: README title "Other" differs from "Fixture"',
      );
    });

    it("flags a Superseded or amended by mismatch", () => {
      const adrs = [
        fixtureAdr("0001", "Accepted. Partly superseded by [0002](0002-fixture.md)."),
        fixtureAdr("0002", "Accepted. Partly supersedes [0001](0001-fixture.md)."),
      ];
      const indexContent = `${fixtureRow("Fixture", "-")}\n| 0002 | [Fixture](0002-fixture.md) | Accepted | - |`;
      expect(findAdrViolations(adrs, indexContent)).toContain(
        '0001-fixture.md: README "Superseded or amended by" is "-", expected "0002 (partly)"',
      );
    });

    it("flags a claimed relation the files do not record", () => {
      expect(findAdrViolations([fixtureAdr("0001")], fixtureRow("Fixture", "0002"))).toContain(
        '0001-fixture.md: README "Superseded or amended by" is "0002", expected "-"',
      );
    });
  });

  it("flags relation wording without a linked ADR number", () => {
    const violations = findAdrViolations(
      [fixtureAdr("0001", "Accepted. Amended by a later decision.")],
      index,
    );
    expect(violations).toContain("0001-fixture.md: relation wording must link the ADR number");
  });

  it("flags an unlisted ADR", () => {
    const violations = findAdrViolations(
      [fixtureAdr("0001"), fixtureAdr("0002")],
      "[a](0001-fixture.md)",
    );
    expect(violations).toContain("0002-fixture.md: not listed in README");
  });

  it("flags a bad header", () => {
    const bad: AdrFile = { ...fixtureAdr("0003"), content: "# Oops\n" };
    const violations = findAdrViolations([fixtureAdr("0001"), bad], index);
    expect(violations).toContain("0003-fixture.md: bad header");
  });

  it("allows gaps in numbering", () => {
    const violations = findAdrViolations(
      [fixtureAdr("0001"), fixtureAdr("0003")],
      "[a](0001-fixture.md) [b](0003-fixture.md)",
    );
    expect(violations).toEqual([]);
  });

  it("allows numbering that does not start at 0001", () => {
    expect(findAdrViolations([fixtureAdr("0002")], "[b](0002-fixture.md)")).toEqual([]);
  });

  it("flags descending numbers", () => {
    const violations = findAdrViolations([fixtureAdr("0002"), fixtureAdr("0001")], index);
    expect(violations).toContain("ADR numbers are not ascending");
  });

  it("flags an index entry with no file", () => {
    const violations = findAdrViolations([fixtureAdr("0001")], index);
    expect(violations).toContain("0002-fixture.md: listed in README but missing");
  });
});
