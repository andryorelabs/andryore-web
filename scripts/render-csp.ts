import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SCRIPT_PLACEHOLDER = "__SCRIPT_HASHES__";
const STYLE_PLACEHOLDER = "__STYLE_HASHES__";
const META_POLICY = /<meta\s+http-equiv="content-security-policy"\s+content="([^"]*)"/i;
const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script[^>]*>/gi;
const INLINE_STYLE = /<style\b([^>]*)>([\s\S]*?)<\/style[^>]*>/gi;
const EXECUTABLE_SCRIPT_TYPES = new Set(["", "module", "text/javascript"]);

/**
The `sha256` sources of a page or a built site.
 */
export interface PolicyHashes {
  script: string[];
  style: string[];
}

/**
 * Computes the CSP hash source of an inline block.
 * @param content The exact text between the opening and closing tags.
 * @returns The `'sha256-…'` source, quotes included.
 */
export function hashSource(content: string): string {
  return `'sha256-${createHash("sha256").update(content).digest("base64")}'`;
}

/**
 * Reads the hash sources of one directive from a page's meta policy.
 * @param html The page markup as written to the build output.
 * @param directive The directive name, such as `script-src`.
 * @returns The `'sha256-…'` sources, empty when the page has no such policy.
 */
export function metaHashes(html: string, directive: string): Set<string> {
  const policy = META_POLICY.exec(html)?.[1] ?? "";
  const entry = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${directive} `));
  return new Set(entry?.match(/'sha256-[^']+'/g));
}

function scriptType(attributes: string): string {
  return /\btype\s*=\s*"([^"]*)"/i.exec(attributes)?.[1]?.toLowerCase() ?? "";
}

function inlineBlocks(
  html: string,
  pattern: RegExp,
  isExecutable: (attributes: string) => boolean,
): string[] {
  return html
    .matchAll(pattern)
    .filter((match) => isExecutable(match[1] ?? ""))
    .map((match) => match[2] ?? "")
    .toArray();
}

function listHtmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(entryPath);
    return entry.name.endsWith(".html") ? entryPath : [];
  });
}

function checkCovered(kind: string, file: string, hashes: string[], allowed: Set<string>): void {
  for (const hash of hashes) {
    if (!allowed.has(hash)) {
      throw new Error(`${file}: inline ${kind} ${hash} has no hash in its policy`);
    }
  }
}

/**
 * Hashes the executable inline scripts and styles of a built page and checks
 * that the page's own meta policy already carries each hash (ADR 0012).
 * @param html The page markup as written to the build output.
 * @param file The page path, used in the error message.
 * @returns The hashes of the page's inline scripts and styles.
 * @throws {Error} When a block is missing from the page's own meta policy.
 */
export function pageHashes(html: string, file: string): PolicyHashes {
  const script = inlineBlocks(
    html,
    INLINE_SCRIPT,
    (attributes) =>
      !/\bsrc\s*=/i.test(attributes) && EXECUTABLE_SCRIPT_TYPES.has(scriptType(attributes)),
  ).map((content) => hashSource(content));
  const style = inlineBlocks(html, INLINE_STYLE, () => true).map((content) => hashSource(content));
  checkCovered("script", file, script, metaHashes(html, "script-src"));
  checkCovered("style", file, style, metaHashes(html, "style-src"));
  return { script, style };
}

function sortedUnion(sets: Set<string>): string[] {
  return [...sets].toSorted((left, right) => left.localeCompare(right));
}

/**
 * Hashes every inline script and style across a built site.
 * @param distributionDirectory The build output directory.
 * @returns The union of the hashes, sorted.
 */
export function collectHashes(distributionDirectory: string): PolicyHashes {
  const script = new Set<string>();
  const style = new Set<string>();
  for (const file of listHtmlFiles(distributionDirectory)) {
    const hashes = pageHashes(readFileSync(file, "utf8"), file);
    for (const hash of hashes.script) script.add(hash);
    for (const hash of hashes.style) style.add(hash);
  }
  return { script: sortedUnion(script), style: sortedUnion(style) };
}

/**
 * Fills the hash placeholders of the security headers template.
 * @param template The template text.
 * @param hashes The hashes to render.
 * @returns The rendered nginx snippet.
 */
export function renderPolicy(template: string, hashes: PolicyHashes): string {
  return template
    .replace(SCRIPT_PLACEHOLDER, () => hashes.script.join(" "))
    .replace(STYLE_PLACEHOLDER, () => hashes.style.join(" "))
    .replaceAll(" ;", ";");
}

/**
 * Entry point: renders the security headers snippet for a built site.
 * @param argumentsList The build directory, the template and the output path.
 * @returns 0 on success, 2 when an argument is missing.
 */
function main(argumentsList: string[]): number {
  const [distributionDirectory, templatePath, outputPath] = argumentsList;
  if (!distributionDirectory || !templatePath || !outputPath) {
    console.error("usage: render-csp.ts <dist> <template> <output>");
    return 2;
  }
  const hashes = collectHashes(distributionDirectory);
  writeFileSync(outputPath, renderPolicy(readFileSync(templatePath, "utf8"), hashes));
  console.log(
    `render-csp: ${String(hashes.script.length)} script and ${String(hashes.style.length)} style hashes`,
  );
  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
