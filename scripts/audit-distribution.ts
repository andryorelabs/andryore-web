import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
Origins the built Site may load from besides itself (ADR 0009, ADR 0014).
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  "https://andryore.dev",
  "https://cloud.umami.is",
  "https://gateway.umami.is",
];

const ELEMENT = /<(a|link|script|img|source|iframe|form|video|audio)\b([^>]*)>/gi;
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;
const CSS_URL = /(?:url\(\s*|@import\s+)["']?((?:https?:)?\/\/[^"')\s;]+)/gi;
const REQUESTING_LINK_TYPES = new Set([
  "stylesheet",
  "preload",
  "prefetch",
  "modulepreload",
  "preconnect",
  "dns-prefetch",
  "icon",
  "manifest",
]);

function readAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const [, name = "", value = ""] of source.matchAll(ATTRIBUTE)) {
    attributes.set(name.toLowerCase(), value);
  }
  return attributes;
}

function originOf(url: string): string | undefined {
  if (!/^(?:https?:)?\/\//i.test(url)) return undefined;
  try {
    return new URL(url, "https://placeholder.invalid").origin;
  } catch {
    return undefined;
  }
}

function isForeign(url: string): boolean {
  const origin = originOf(url);
  return origin !== undefined && !ALLOWED_ORIGINS.includes(origin);
}

function tokensOf(value = ""): string[] {
  return value.toLowerCase().split(/\s+/);
}

/**
 * Finds third-party requests and unsafe external links in one HTML page.
 * Plain anchors are not requests, but an external one must carry
 * `rel="noopener noreferrer"` and `target="_blank"`.
 * @param html The page source.
 * @returns One message per problem; empty when the page is clean.
 */
export function auditHtml(html: string): string[] {
  const problems: string[] = [];
  for (const [, tag = "", rawAttributes = ""] of html.matchAll(ELEMENT)) {
    const attributes = readAttributes(rawAttributes);
    const name = tag.toLowerCase();
    if (name === "a") {
      const href = attributes.get("href") ?? "";
      if (!isForeign(href)) continue;
      const linkTypes = tokensOf(attributes.get("rel"));
      const isUnprotected = !(linkTypes.includes("noopener") && linkTypes.includes("noreferrer"));
      if (isUnprotected) {
        problems.push(`external link without noopener noreferrer: ${href}`);
      }
      if (attributes.get("target")?.toLowerCase() !== "_blank") {
        problems.push(`external link without target="_blank": ${href}`);
      }
      continue;
    }
    if (
      name === "link" &&
      tokensOf(attributes.get("rel")).every((type) => !REQUESTING_LINK_TYPES.has(type))
    ) {
      continue;
    }
    const target = attributes.get("src") ?? attributes.get("href") ?? "";
    const action = attributes.get("action") ?? "";
    for (const candidate of [target, action]) {
      if (isForeign(candidate)) {
        problems.push(`third-party request in <${name}>: ${candidate}`);
      }
    }
  }
  return problems;
}

/**
 * Finds third-party requests in one stylesheet.
 * @param css The stylesheet source.
 * @returns One message per problem; empty when the stylesheet is clean.
 */
export function auditCss(css: string): string[] {
  return css
    .matchAll(CSS_URL)
    .map(([, url = ""]) => url)
    .filter((url) => isForeign(url))
    .map((url) => `third-party request in CSS: ${url}`)
    .toArray();
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Audits every HTML and CSS file under a build directory.
 * @param directory The build output, usually `dist`.
 * @returns One message per problem, prefixed by its file.
 */
export function auditDirectory(directory: string): string[] {
  return listFiles(directory).flatMap((file) => {
    let audit: ((source: string) => string[]) | undefined;
    if (file.endsWith(".html")) audit = auditHtml;
    else if (file.endsWith(".css")) audit = auditCss;
    if (audit === undefined) return [];
    const relative = path.relative(directory, file);
    return audit(readFileSync(file, "utf8")).map((problem) => `${relative}: ${problem}`);
  });
}

if (import.meta.main) {
  const directory = path.resolve(process.argv[2] ?? "dist");
  const problems = auditDirectory(directory);
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length > 0 ? 1 : 0;
  if (problems.length === 0) console.log(`dist audit passed for ${directory}`);
}
