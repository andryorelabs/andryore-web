import { describe, expect, test } from "bun:test";

import { listWorkflowFiles, parseWorkflow, readWorkflow, readWorkflowText } from "./workflow-files";

describe("parseWorkflow", () => {
  test("parses jobs and steps into a plain object", () => {
    const workflow = parseWorkflow("on: push\njobs:\n  build:\n    steps:\n      - run: echo hi\n");
    expect(workflow.on).toBe("push");
    expect(workflow.jobs?.build?.steps?.[0]?.run).toBe("echo hi");
  });
});

describe("listWorkflowFiles", () => {
  test("returns sorted YAML file names only", () => {
    const files = listWorkflowFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((name) => /\.ya?ml$/.test(name))).toBe(true);
    expect(files).toEqual(files.toSorted((a, b) => a.localeCompare(b)));
  });
});

describe("readWorkflow", () => {
  test("reads the raw text and the parsed document of a real workflow", () => {
    const fileName = listWorkflowFiles()[0] ?? "";
    expect(readWorkflowText(fileName)).toContain("jobs:");
    expect(readWorkflow(fileName).jobs).toBeDefined();
  });
});
