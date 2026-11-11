import path from "node:path";

import { readTranslatedEntries } from "../src/i18n/translated-entries";
import { findStaleTranslations } from "../src/i18n/translations";

const root = path.resolve(import.meta.dir, "..");
const problems = findStaleTranslations(readTranslatedEntries(root));

if (problems.length === 0) {
  console.log("Every translation matches its English source.");
} else {
  console.error(problems.map((problem) => `- ${problem}`).join("\n"));
  process.exitCode = 1;
}
