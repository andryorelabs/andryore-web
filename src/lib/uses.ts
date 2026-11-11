import type { GlyphName } from "./glyphs";
import { ICONS, type IconId } from "./icons";

/**
 * One Tools or Tech badge.
 */
export interface UsesBadge {
  name: string;
  icon: IconId;
  url?: string | undefined;
}

/**
 * A decorative icon of the floating field and where it sits.
 */
export interface FieldIcon {
  id: IconId;
  placement: string;
}

/**
 * The brand icons floating over the Uses title, in canvas order. The
 * positions are literal classes because the CSP forbids inline styles.
 */
export const FIELD_ICONS: readonly FieldIcon[] = [
  {
    id: "typescript",
    placement:
      "left-[8%] top-[12%] size-[84px] max-[639px]:top-4 max-[639px]:left-[6%] max-[639px]:size-11",
  },
  {
    id: "bun",
    placement:
      "left-[20%] top-[62%] size-[64px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[6%] max-[639px]:size-11",
  },
  {
    id: "astro",
    placement:
      "left-[30%] top-[18%] size-[72px] max-[639px]:top-4 max-[639px]:left-[28%] max-[639px]:size-11",
  },
  {
    id: "react",
    placement:
      "left-[44%] top-[70%] size-[96px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[28%] max-[639px]:size-12",
  },
  {
    id: "nextjs",
    placement:
      "left-[58%] top-[8%] size-[60px] max-[639px]:top-4 max-[639px]:left-[50%] max-[639px]:size-11",
  },
  {
    id: "tailwindcss",
    placement:
      "left-[66%] top-[66%] size-[72px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[50%] max-[639px]:size-11",
  },
  {
    id: "claude",
    placement:
      "left-[78%] top-[20%] size-[84px] max-[639px]:top-4 max-[639px]:left-[72%] max-[639px]:size-12",
  },
  {
    id: "docker",
    placement:
      "left-[88%] top-[58%] size-[64px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[72%] max-[639px]:size-11",
  },
];

/**
 * The Lucide glyphs of the Setup rows, in row order.
 */
export const SETUP_GLYPHS: readonly GlyphName[] = [
  "laptop",
  "mic",
  "camera",
  "mouse",
  "keyboard",
  "usb",
  "headphones",
];

/**
 * A real colour token shown as a swatch of the This site Color tile.
 */
export interface SwatchToken {
  token: string;
  bg: string;
}

/**
 * The six tokens of the Color tile; the classes follow the active theme.
 */
export const SWATCH_TOKENS: readonly SwatchToken[] = [
  { token: "background", bg: "bg-background" },
  { token: "card", bg: "bg-card" },
  { token: "border", bg: "bg-border" },
  { token: "muted-foreground", bg: "bg-muted-foreground" },
  { token: "foreground", bg: "bg-foreground" },
  { token: "primary", bg: "bg-primary" },
];

interface BadgeColor {
  hex: string;
  bg: string;
  ink: "light" | "dark";
}

/**
 * Brand colour of each badge and the ink set by hand per the canvas table:
 * `light` is white text on the brand colour, `dark` is near-black text. Where
 * the canvas sets white on a bright brand colour, the background is darkened
 * just enough for 4.5:1 contrast. The classes are literals because the CSP
 * forbids inline styles and Tailwind only emits classes it can read.
 */
export const BADGE_COLORS: Readonly<Partial<Record<IconId, BadgeColor>>> = {
  claude: { hex: "#b06046", bg: "bg-[#b06046]", ink: "light" },
  nushell: { hex: "#438405", bg: "bg-[#438405]", ink: "light" },
  starship: { hex: "#dd0b78", bg: "bg-[#dd0b78]", ink: "light" },
  git: { hex: "#da372a", bg: "bg-[#da372a]", ink: "light" },
  github: { hex: "#181717", bg: "bg-[#181717]", ink: "light" },
  "github-actions": { hex: "#1b74d9", bg: "bg-[#1b74d9]", ink: "light" },
  linear: { hex: "#5e6ad2", bg: "bg-[#5e6ad2]", ink: "light" },
  docker: { hex: "#1d79c0", bg: "bg-[#1d79c0]", ink: "light" },
  coolify: { hex: "#6b16ed", bg: "bg-[#6b16ed]", ink: "light" },
  tailscale: { hex: "#242424", bg: "bg-[#242424]", ink: "light" },
  cloudflare: { hex: "#f38020", bg: "bg-[#f38020]", ink: "dark" },
  bitwarden: { hex: "#175ddc", bg: "bg-[#175ddc]", ink: "light" },
  typescript: { hex: "#3178c6", bg: "bg-[#3178c6]", ink: "light" },
  bun: { hex: "#000000", bg: "bg-[#000000]", ink: "light" },
  astro: { hex: "#a749d4", bg: "bg-[#a749d4]", ink: "light" },
  react: { hex: "#61dafb", bg: "bg-[#61dafb]", ink: "dark" },
  nextjs: { hex: "#000000", bg: "bg-[#000000]", ink: "light" },
  hono: { hex: "#c35302", bg: "bg-[#c35302]", ink: "light" },
  tailwindcss: { hex: "#06b6d4", bg: "bg-[#06b6d4]", ink: "dark" },
  "shadcn-ui": { hex: "#000000", bg: "bg-[#000000]", ink: "light" },
  prisma: { hex: "#2d3748", bg: "bg-[#2d3748]", ink: "light" },
  supabase: { hex: "#3fcf8e", bg: "bg-[#3fcf8e]", ink: "dark" },
  zod: { hex: "#408aff", bg: "bg-[#408aff]", ink: "dark" },
  tanstack: { hex: "#ece8d1", bg: "bg-[#ece8d1]", ink: "dark" },
  "better-auth": { hex: "#ffffff", bg: "bg-[#ffffff]", ink: "dark" },
  resend: { hex: "#000000", bg: "bg-[#000000]", ink: "light" },
  posthog: { hex: "#000000", bg: "bg-[#000000]", ink: "light" },
  dotenv: { hex: "#ecd53f", bg: "bg-[#ecd53f]", ink: "dark" },
  wxt: { hex: "#67d55e", bg: "bg-[#67d55e]", ink: "dark" },
  turborepo: { hex: "#e51b4d", bg: "bg-[#e51b4d]", ink: "light" },
  playwright: { hex: "#248728", bg: "bg-[#248728]", ink: "light" },
  eslint: { hex: "#4b32c3", bg: "bg-[#4b32c3]", ink: "light" },
  prettier: { hex: "#f7b93e", bg: "bg-[#f7b93e]", ink: "dark" },
  knip: { hex: "#bf560c", bg: "bg-[#bf560c]", ink: "light" },
};

/**
 * Brands whose own multicolour logo stays on a light grey `.bdg.alt` badge
 * instead of a brand-coloured one.
 */
export const ALT_BADGES: ReadonlySet<IconId> = new Set<IconId>([
  "orca",
  "chezmoi",
  "mise",
  "base-ui",
  "trigger-dev",
  "remotion",
]);

/**
 * The classes and brand colour of one badge.
 */
export interface BadgeStyle {
  hex: string;
  bg: string;
  text: string;
  logo: string;
}

const ALT_STYLE: BadgeStyle = {
  hex: "#eef0f4",
  bg: "bg-[#eef0f4]",
  text: "text-[#15191f]",
  logo: "",
};

/**
 * Picks the badge classes: the grey alt look with a full-colour logo, or the
 * brand colour with a white or near-black name and a matching logo.
 * @param id An icon id that has a badge colour or is an alt badge.
 * @returns Literal Tailwind classes for the background, text and logo.
 */
export function badgeStyle(id: IconId): BadgeStyle {
  if (ALT_BADGES.has(id)) return ALT_STYLE;
  const color = BADGE_COLORS[id];
  if (color === undefined) throw new Error(`No badge colour for icon "${id}"`);
  if (color.ink === "light") {
    return {
      hex: color.hex,
      bg: color.bg,
      text: "text-white",
      logo: "brightness-0 invert",
    };
  }
  return {
    hex: color.hex,
    bg: color.bg,
    text: "text-[#111111]",
    logo: "brightness-0",
  };
}

/**
 * Narrows a content string to an icon id.
 * @param id The `icon` field of a content row.
 * @returns The same id, typed.
 */
export function badgeIconId(id: string): IconId {
  if (!Object.hasOwn(ICONS, id)) throw new Error(`Unknown icon id "${id}"`);
  return id as IconId;
}

const FLOAT_CLASSES = ["uses-float-6", "uses-float-7", "uses-float-8"] as const;

/**
 * Float animation of the icon at `index`. The three floats last 6, 7 and 8
 * seconds so neighbouring icons never move in step.
 * @param index Position of the icon in the field.
 * @returns A literal `uses-float-N` class the stylesheet defines.
 */
export function floatClass(index: number): (typeof FLOAT_CLASSES)[number] {
  const step = Math.max(0, Math.floor(index));
  return FLOAT_CLASSES[step % FLOAT_CLASSES.length] ?? "uses-float-6";
}
