import { z } from "astro/zod";

import { localePath, type Locale } from "../i18n/locales";
import { GLYPH_BODIES, type GlyphName } from "./glyphs";
import { ICONS, type IconId } from "./icons";

/**
 * Lifecycle states a product pill can show.
 */
const PRODUCT_STATES = ["live", "beta", "contribution"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

const proofRowSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  date: z.string().refine(isRealDate, "Proof needs a real YYYY-MM-DD date"),
});

export type ProofRow = z.infer<typeof proofRowSchema>;

const iconLabelSchema = z.object({
  icon: z.string().min(1),
  label: z.string().min(1),
});

const statSchema = z.object({
  icon: z.string().min(1),
  value: z.string().min(1),
  label: z.string().min(1),
  date: z.string().refine(isRealDate, "A dated stat needs a real YYYY-MM-DD date").optional(),
});

const platformSchema = iconLabelSchema.extend({
  href: z.url().optional(),
});

const cardSchema = z.object({
  icon: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

const calloutSchema = z.object({
  icon: z.string().min(1),
  title: z.string().min(1).optional(),
  body: z.string().min(1),
});

const linksSchema = z.object({
  npm: z.url().optional(),
  chromeWebStore: z.url().optional(),
  source: z.url().optional(),
  marketplace: z.url().optional(),
});

const createSpriteSchema = <Source extends z.ZodType>(imageSource: Source) =>
  z.object({
    src: imageSource,
    alt: z.string().min(1),
    frames: z.number().int().positive(),
    fps: z.number().int().positive(),
  });

const createWebsiteSchema = <Source extends z.ZodType>(imageSource: Source) =>
  z.object({
    src: imageSource,
    alt: z.string().min(1),
    host: z.string().min(1),
  });

const createGalleryItemSchema = <Source extends z.ZodType>(imageSource: Source) =>
  z.object({ src: imageSource, alt: z.string().min(1) });

/**
 * Schema of one product file. A proof row cannot exist without its date, so a
 * number never ships undated. `draft` and `image.placeholder` flag content
 * that still needs the owner's approval (ADR 0007).
 * @param imageSource The field type of `image.src`: Astro's `image()` helper
 *   in the collection, a plain string in tests.
 * @returns The Zod object schema.
 */
export function createProductSchema<Source extends z.ZodType>(imageSource: Source) {
  return z.object({
    key: z.string().min(1),
    lang: z.enum(["en", "es"]),
    name: z.string().min(1),
    value: z.string().min(1),
    description: z.string().min(1).max(160),
    state: z.enum(PRODUCT_STATES),
    url: z.url(),
    changelog: z.url().optional(),
    kind: z.enum(["product", "contribution"]).default("product"),
    version: z.string().min(1).optional(),
    year: z.string().regex(/^\d{4}(?:–\d{2})?$/),
    stats: z.array(statSchema).default([]),
    platforms: z.array(platformSchema).default([]),
    platformNote: z.string().min(1).optional(),
    importsFrom: z.array(iconLabelSchema).default([]),
    exportFormats: z.array(iconLabelSchema).default([]),
    importFormats: z.array(iconLabelSchema).default([]),
    cards: z.array(cardSchema).default([]),
    callout: calloutSchema.optional(),
    skinTones: z.boolean().default(false),
    links: linksSchema.default({}),
    sprites: z.array(createSpriteSchema(imageSource)).default([]),
    website: createWebsiteSchema(imageSource).optional(),
    gallery: z.array(createGalleryItemSchema(imageSource)).default([]),
    stack: z.array(z.string().min(1)).min(1),
    proof: z.array(proofRowSchema).default([]),
    image: z.object({
      src: imageSource,
      alt: z.string().min(1),
      placeholder: z.boolean().default(false),
    }),
    draft: z.boolean().default(false),
  });
}

type ProductData = z.infer<ReturnType<typeof createProductSchema<z.ZodType<ImageMetadata>>>>;

/**
 * A product collection entry as pages use it. Typed here because the
 * generated `astro:content` types are not available to lint or `tsc`.
 */
export interface ProductEntry {
  id: string;
  data: ProductData;
}

/**
 * Proof rows that may be shown: only those with both a value and a date.
 * @param rows The proof rows of a product, if any.
 * @returns The displayable rows; empty when there is no proof.
 */
export function visibleProof(rows: readonly ProofRow[] | undefined): ProofRow[] {
  return (rows ?? []).filter((row) => row.value !== "" && row.date !== "");
}

/**
 * Formats a proof date in the page language.
 * @param isoDate A `YYYY-MM-DD` date.
 * @param locale The page language.
 * @returns A long date such as `September 1, 2026`, in UTC so it never drifts.
 */
export function formatProofDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/**
 * Fills a `{name}` style placeholder of a UI string with literal text.
 * @param template The UI string.
 * @param name The placeholder name, without braces.
 * @param value The text to insert, taken literally.
 * @returns The template with every occurrence replaced.
 */
export function fillPlaceholder(template: string, name: string, value: string): string {
  return template.split(`{${name}}`).join(value);
}

/**
 * Product keys that have an English file, read from the file names so callers
 * need no generated content types.
 * @param files Product file paths such as `./snug.en.md`.
 * @returns The sorted shared keys.
 */
export function englishProductKeys(files: readonly string[]): string[] {
  return files
    .flatMap((file) => /([^/]+)\.en\.md$/.exec(file)?.[1] ?? [])
    .toSorted((a, b) => a.localeCompare(b));
}

/**
 * Path of a product page in a language.
 * @param locale The page language.
 * @param key The shared product key.
 * @returns `/products/<key>/`, prefixed with `/es` for Spanish.
 */
export function productPath(locale: Locale, key: string): string {
  return localePath(locale, `/products/${key}/`);
}

/**
 * The kinds of call to action a product header can carry.
 */
export type HeaderLinkId = "website" | "source" | "npm" | "marketplace" | "chromeWebStore";

export interface HeaderLink {
  id: HeaderLinkId;
  href: string;
}

/**
 * The links a product can carry, as the schema defines them.
 */
export interface ProductLinkSet {
  npm?: string | undefined;
  chromeWebStore?: string | undefined;
  source?: string | undefined;
  marketplace?: string | undefined;
}

/**
 * The header calls to action of a product, in display order.
 * @param product The product's website and optional link set.
 * @param product.url The product website.
 * @param product.links Source, npm, marketplace and Chrome Web Store links, when they exist.
 * @returns The website first, then npm, marketplace, Chrome Web Store and source when present.
 */
export function headerLinks(product: { url: string; links: ProductLinkSet }): HeaderLink[] {
  const { links } = product;
  const candidates: { id: HeaderLinkId; href: string | undefined }[] = [
    { id: "npm", href: links.npm },
    { id: "marketplace", href: links.marketplace },
    { id: "chromeWebStore", href: links.chromeWebStore },
    { id: "source", href: links.source },
  ];
  const present = candidates.filter(
    (candidate): candidate is HeaderLink => candidate.href !== undefined,
  );
  return [{ id: "website", href: product.url }, ...present];
}

/**
 * The label of a stat with its date folded in.
 * @param label The stat label as written in the product file.
 * @param date The `YYYY-MM-DD` date of the figure, if it has one.
 * @returns The label, then the date after a comma when the label already
 *   holds a middle dot, otherwise after a middle dot.
 */
export function statLabel(label: string, date: string | undefined): string {
  if (!date) return label;
  return `${label}${label.includes("·") ? ", " : " · "}${date}`;
}

const COUNTABLE_STAT = /^(\d{1,3}(?:[.,]\d{3})+|\d+)(\+?)$/;

/**
 * Splits a stat value into the integer a count-up can animate and its suffix.
 * @param value The stat value as written, such as `75,000+` or `75.000+`.
 * @returns The total and suffix, or `undefined` for versions, decimals, words
 *   and year ranges, which must not count up.
 */
export function countableStat(value: string): { total: number; suffix: string } | undefined {
  const match = COUNTABLE_STAT.exec(value);
  if (!match) return undefined;
  const [, digits = "", suffix = ""] = match;
  return { total: Number(digits.replaceAll(/[.,]/g, "")), suffix };
}

export type ProductIconReference =
  | { kind: "brand"; id: IconId }
  | { kind: "glyph"; name: GlyphName };

/**
 * Decides whether an icon name from a product file is a brand logo or a
 * Lucide glyph.
 * @param name The icon name as written in the product file.
 * @returns A tagged reference, or `undefined` when the name is in neither set.
 */
export function classifyIcon(name: string): ProductIconReference | undefined {
  const brandIds: readonly string[] = Object.keys(ICONS);
  if (brandIds.includes(name)) return { kind: "brand", id: name as IconId };
  const glyphNames: readonly string[] = Object.keys(GLYPH_BODIES);
  return glyphNames.includes(name) ? { kind: "glyph", name: name as GlyphName } : undefined;
}

const STACK_ICONS: Readonly<Record<string, IconId>> = {
  react: "react",
  typescript: "typescript",
  "tailwind css": "tailwindcss",
  "shadcn/ui": "shadcn-ui",
  wxt: "wxt",
  astro: "astro",
  "astro + starlight": "astro",
};

/**
 * The brand icon of a stack badge.
 * @param label The stack name as written in the product file.
 * @returns The icon id, or `undefined` when the stack has no logo.
 */
export function stackIconId(label: string): IconId | undefined {
  return STACK_ICONS[label.toLowerCase()];
}

const STACK_BADGE_CLASSES: Readonly<Record<string, string>> = {
  wxt: "bg-[#67D55E] text-[#111]",
  react: "bg-[#61DAFB] text-[#111]",
  typescript: "bg-[#3178C6] text-white",
  "tailwind css": "bg-[#06B6D4] text-[#111]",
  "shadcn/ui": "bg-[#000] text-white",
  astro: "bg-[#BC52EE] text-[#111]",
  "astro + starlight": "bg-[#BC52EE] text-[#111]",
};

const STACK_HREFS: Readonly<Record<string, string>> = {
  wxt: "https://wxt.dev",
  react: "https://react.dev",
  typescript: "https://www.typescriptlang.org",
  "tailwind css": "https://tailwindcss.com",
  "shadcn/ui": "https://ui.shadcn.com",
  astro: "https://astro.build",
  "astro + starlight": "https://starlight.astro.build",
};

/**
 * The official site of a stack item.
 * @param label The stack name as written in the product file.
 * @returns The site URL, or `undefined` when the stack has no known site.
 */
export function stackHref(label: string): string | undefined {
  return STACK_HREFS[label.toLowerCase()];
}

/**
 * The coloured badge classes of a stack item. They are literal so the Tailwind
 * scanner sees them, and each pair is the canvas brand colour with its text colour.
 * @param label The stack name as written in the product file.
 * @returns Background and text classes, neutral when the stack is unknown.
 */
export function stackBadgeClass(label: string): string {
  return STACK_BADGE_CLASSES[label.toLowerCase()] ?? "bg-muted text-foreground";
}

const STACK_GLYPH_CLASSES: Readonly<Record<string, string>> = {
  wxt: "text-foreground dark:text-[#67D55E]",
  react: "text-foreground dark:text-[#61DAFB]",
  typescript: "text-[#3178C6]",
  "tailwind css": "text-foreground dark:text-[#06B6D4]",
  "shadcn/ui": "text-foreground",
  astro: "text-[#BC52EE]",
  "astro + starlight": "text-[#BC52EE]",
};

/**
 * The text colour a bare stack glyph is drawn in: the brand colour of
 * `stackBadgeClass`. A colour under 3:1 against the light card is only used in
 * dark mode, and shadcn/ui, which is black, keeps the foreground.
 * @param label The stack name as written in the product file.
 * @returns Literal text classes, the foreground when the stack is unknown.
 */
export function stackGlyphClass(label: string): string {
  return STACK_GLYPH_CLASSES[label.toLowerCase()] ?? "text-foreground";
}

/**
 * The year and version line of a product card.
 * @param year The four-digit year, or a year range.
 * @param version The release tag such as `v2.2.0`, when the product has one.
 * @returns `year · version`, or just the year without a version.
 */
export function productMetaLabel(year: string, version?: string): string {
  return [year, version].filter(Boolean).join(" · ");
}

/**
 * One stack entry of a product card meta row.
 */
export interface StackMetaItem {
  readonly label: string;
  readonly iconId?: IconId;
  readonly colorClass?: string;
}

/**
 * The stack of a product card, each item as an icon or, without a logo, a name.
 * @param stack The stack names as written in the product file.
 * @returns One item per stack name; only items with a logo carry an icon id and colour.
 */
export function stackMetaItems(stack: readonly string[]): StackMetaItem[] {
  return stack.map((label) => {
    const iconId = stackIconId(label);
    return iconId === undefined ? { label } : { label, iconId, colorClass: stackGlyphClass(label) };
  });
}

/**
 * Background classes of the six emoji skin-tone swatches, default first. They
 * are literal so the Tailwind scanner sees them and no inline style is needed.
 */
export const SKIN_TONE_CLASSES = [
  "bg-[#ffc83d]",
  "bg-[#f7dfc4]",
  "bg-[#e3b98d]",
  "bg-[#c69260]",
  "bg-[#946239]",
  "bg-[#5f4130]",
] as const;
