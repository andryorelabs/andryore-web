import { writeFileSync } from "node:fs";
import path from "node:path";

import { usableCredential } from "../src/lib/credential";
import { fetchContributionGrid } from "../src/lib/github-grid";

const snapshot = await fetchContributionGrid({
  token: usableCredential(process.env.GITHUB_TOKEN),
  login: "AndryOre",
  now: new Date(),
  fetchImpl: (url, init) => fetch(url, init),
});

if (!snapshot) {
  throw new Error("Could not fetch the contribution grid; set GITHUB_TOKEN and retry.");
}

const target = path.resolve(import.meta.dir, "..", "src", "content", "github-grid.json");
writeFileSync(target, `${JSON.stringify(snapshot)}\n`);
console.log(`Wrote ${target} (${String(snapshot.total)} contributions)`);
