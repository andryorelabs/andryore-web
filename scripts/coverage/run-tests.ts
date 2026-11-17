import path from "node:path";

import { checkCoverageReport, isFullSuiteRun } from "./check-threshold";

/**
 * Runs `bun test` with any extra arguments, then gates coverage on a full run.
 * A filtered run (a path or name filter) measures only part of the suite, so it skips the gate.
 */
const extraArguments = process.argv.slice(2);
const testRun = Bun.spawnSync(["bun", "test", ...extraArguments], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

let exitCode = testRun.exitCode;
if (exitCode === 0 && isFullSuiteRun(extraArguments)) {
  const failures = checkCoverageReport(path.resolve(import.meta.dir, "../.."));
  for (const failure of failures) console.error(failure);
  exitCode = failures.length === 0 ? 0 : 1;
}
process.exitCode = exitCode;
