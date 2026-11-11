import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";

const templateDirectory = import.meta.dir;

interface IssueForm {
  name?: string;
  description?: string;
  labels?: string[];
  body?: { type: string; id?: string }[];
}

async function parseYaml(fileName: string) {
  const source = await Bun.file(path.join(templateDirectory, fileName)).text();
  return Bun.YAML.parse(source) as Record<string, unknown>;
}

const formFileNames = readdirSync(templateDirectory)
  .filter((fileName) => fileName.endsWith(".yml") && fileName !== "config.yml")
  .toSorted((left, right) => left.localeCompare(right));

describe("issue forms", () => {
  it("ships exactly the bug, feature, enhancement and documentation forms", () => {
    expect(formFileNames).toEqual([
      "1-bug-report.yml",
      "2-feature-request.yml",
      "3-enhancement-request.yml",
      "4-documentation-bug.yml",
    ]);
  });

  for (const fileName of formFileNames) {
    describe(fileName, () => {
      it("declares name, description and a non-empty body", async () => {
        const form = (await parseYaml(fileName)) as IssueForm;
        expect(typeof form.name).toBe("string");
        expect(typeof form.description).toBe("string");
        expect(Array.isArray(form.body)).toBe(true);
        expect(form.body?.length).toBeGreaterThan(0);
      });

      it("auto-applies a non-empty labels list", async () => {
        const form = (await parseYaml(fileName)) as IssueForm;
        expect(Array.isArray(form.labels)).toBe(true);
        expect(form.labels?.length).toBeGreaterThan(0);
      });

      it("gives every input element a unique id", async () => {
        const form = (await parseYaml(fileName)) as IssueForm;
        const ids = (form.body ?? [])
          .filter((element) => element.type !== "markdown")
          .map((element) => element.id);
        expect(ids.every((id) => typeof id === "string")).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }
});

describe("config.yml", () => {
  it("disables blank issues", async () => {
    const config = await parseYaml("config.yml");
    expect(config.blank_issues_enabled).toBe(false);
  });

  it("links to Security Advisories and never to Discussions", async () => {
    const config = await parseYaml("config.yml");
    const urls = (config.contact_links as { url: string }[]).map((link) => link.url);
    expect(urls.some((url) => url.includes("/discussions"))).toBe(false);
    expect(urls.some((url) => url.includes("/security/advisories"))).toBe(true);
  });
});
