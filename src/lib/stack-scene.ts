import uses from "../content/uses.json";
import type { Locale } from "../i18n/locales";
import type { IconId } from "./icons";

/**
 * Pixel size of the three tile boxes at the canvas scale.
 */
export type TileSize = 96 | 84 | 72 | 60 | 56 | 48 | 44;

/**
 * One decorative tile of a scattered field.
 */
export interface StackTile {
  id: GlowIconId;
  size: TileSize;
  mobile: boolean;
  placement: string;
}

/**
 * One tile of the 404 panel.
 */
export interface NotFoundTile {
  id: GlowIconId;
  size: TileSize;
  placement: string;
  delay: number;
}

/**
 * One tile of the end card.
 */
export interface EndCardTile {
  id: GlowIconId;
  tilt: string;
}

/**
 * Literal Tailwind classes for the brand glow (`--g`) of each icon the scene
 * uses; the black and white logos take the neutral `#8b93a7`. They are
 * literals because the CSP forbids inline styles and Tailwind only emits
 * classes it can read.
 */
export const GLOW_CLASSES = {
  typescript: "[--g:#3178c6]",
  bun: "[--g:#fbf0df]",
  react: "[--g:#61dafb]",
  nextjs: "[--g:#8b93a7]",
  tailwindcss: "[--g:#38bdf8]",
  "shadcn-ui": "[--g:#8b93a7]",
  prisma: "[--g:#5a67d8]",
  supabase: "[--g:#3ecf8e]",
  zod: "[--g:#408afb]",
  tanstack: "[--g:#ef4444]",
  resend: "[--g:#8b93a7]",
  posthog: "[--g:#f9bd2b]",
  playwright: "[--g:#2ead33]",
  eslint: "[--g:#8080f2]",
  claude: "[--g:#d97757]",
  docker: "[--g:#2496ed]",
  git: "[--g:#f05032]",
  linear: "[--g:#5e6ad2]",
  cloudflare: "[--g:#f6821f]",
  tailscale: "[--g:#8b93a7]",
  remotion: "[--g:#0b84f3]",
  astro: "[--g:#ff5d01]",
  turborepo: "[--g:#ef4444]",
  bitwarden: "[--g:#175ddc]",
} as const satisfies Partial<Record<IconId, string>>;

/**
 * Icons that have a glow class.
 */
export type GlowIconId = keyof typeof GLOW_CLASSES;

/**
 * Brand hex of the glow of an icon, read from its literal class.
 * @param id An icon with a glow class.
 * @returns The `#rrggbb` colour.
 */
export function glowHex(id: GlowIconId): string {
  const hex = /#[0-9a-f]{6}/.exec(GLOW_CLASSES[id])?.[0];
  if (hex === undefined) throw new Error(`No glow hex for icon "${id}"`);
  return hex;
}

const SIZE_CLASSES: Readonly<Record<TileSize, string>> = {
  96: "[--s:96]",
  72: "[--s:72]",
  84: "[--s:84]",
  60: "[--s:60]",
  56: "[--s:56]",
  48: "[--s:48]",
  44: "[--s:44]",
};

/**
 * Class that sets the box size (`--s`, in pixels) of a tile.
 * @param size A tile size.
 * @returns A literal Tailwind class.
 */
export function sizeClass(size: TileSize): string {
  return SIZE_CLASSES[size];
}

/**
 * The scattered field in DOM order. `--x` and `--y` are pixel offsets from the
 * stage centre and `--r` is the tilt in degrees, all as in the design canvas;
 * the stylesheet scales the offsets on narrow screens. The tiles with `mobile`
 * set are the first twelve and stay on narrow screens.
 */
export const STACK_TILES: readonly StackTile[] = [
  {
    id: "typescript",
    size: 96,
    mobile: true,
    placement: "[--x:-430] [--y:-200] [--r:-8]",
  },
  {
    id: "astro",
    size: 96,
    mobile: true,
    placement: "[--x:340] [--y:-250] [--r:6]",
  },
  {
    id: "react",
    size: 96,
    mobile: true,
    placement: "[--x:-540] [--y:60] [--r:7]",
  },
  {
    id: "nextjs",
    size: 96,
    mobile: true,
    placement: "[--x:470] [--y:110] [--r:-6]",
  },
  {
    id: "bun",
    size: 72,
    mobile: true,
    placement: "[--x:-250] [--y:-290] [--r:9]",
  },
  {
    id: "tailwindcss",
    size: 72,
    mobile: true,
    placement: "[--x:-300] [--y:250] [--r:-9]",
  },
  {
    id: "shadcn-ui",
    size: 72,
    mobile: true,
    placement: "[--x:200] [--y:275] [--r:5]",
  },
  {
    id: "docker",
    size: 72,
    mobile: true,
    placement: "[--x:580] [--y:-110] [--r:8]",
  },
  {
    id: "linear",
    size: 56,
    mobile: true,
    placement: "[--x:-120] [--y:-330] [--r:-5]",
  },
  {
    id: "claude",
    size: 56,
    mobile: true,
    placement: "[--x:70] [--y:-320] [--r:10]",
  },
  {
    id: "playwright",
    size: 56,
    mobile: true,
    placement: "[--x:-610] [--y:-160] [--r:6]",
  },
  {
    id: "prisma",
    size: 56,
    mobile: true,
    placement: "[--x:-50] [--y:320] [--r:-7]",
  },
  {
    id: "supabase",
    size: 56,
    mobile: false,
    placement: "[--x:410] [--y:285] [--r:7]",
  },
  {
    id: "zod",
    size: 56,
    mobile: false,
    placement: "[--x:640] [--y:250] [--r:-10]",
  },
  {
    id: "tanstack",
    size: 56,
    mobile: false,
    placement: "[--x:-520] [--y:-290] [--r:4]",
  },
  {
    id: "posthog",
    size: 56,
    mobile: false,
    placement: "[--x:560] [--y:-300] [--r:-6]",
  },
  {
    id: "turborepo",
    size: 56,
    mobile: false,
    placement: "[--x:-600] [--y:260] [--r:8]",
  },
  {
    id: "resend",
    size: 56,
    mobile: false,
    placement: "[--x:500] [--y:-210] [--r:-4]",
  },
  {
    id: "git",
    size: 56,
    mobile: false,
    placement: "[--x:-380] [--y:-30] [--r:5]",
  },
  {
    id: "cloudflare",
    size: 56,
    mobile: false,
    placement: "[--x:390] [--y:0] [--r:-8]",
  },
  {
    id: "tailscale",
    size: 56,
    mobile: false,
    placement: "[--x:230] [--y:-310] [--r:6]",
  },
  {
    id: "bitwarden",
    size: 56,
    mobile: false,
    placement: "[--x:90] [--y:330] [--r:5]",
  },
  {
    id: "remotion",
    size: 56,
    mobile: false,
    placement: "[--x:-190] [--y:-230] [--r:-6]",
  },
  {
    id: "eslint",
    size: 56,
    mobile: false,
    placement: "[--x:560] [--y:50] [--r:9]",
  },
];

/**
 * The five tiles of the end card, each with its tilt.
 */
export const END_CARD_TILES: readonly EndCardTile[] = [
  { id: "typescript", tilt: "-rotate-[7deg]" },
  { id: "astro", tilt: "rotate-[4deg]" },
  { id: "react", tilt: "-rotate-[3deg]" },
  { id: "bun", tilt: "rotate-[6deg]" },
  { id: "shadcn-ui", tilt: "-rotate-[5deg]" },
];

/**
 * The 12 tiles of the 404 panel, as in the design canvas: each is placed by the
 * top-left corner in percent of the panel, tipped at its own angle, and bobs
 * after its own delay in seconds. `delay` also names the `data-nf-delay` value
 * the stylesheet maps to `--d`, so it must be one of `NOT_FOUND_DELAYS`.
 */
export const NOT_FOUND_TILES: readonly NotFoundTile[] = [
  {
    id: "typescript",
    size: 84,
    placement: "left-[8%] top-[14%] [--r:-14deg]",
    delay: 0.5,
  },
  {
    id: "react",
    size: 84,
    placement: "left-[82%] top-[20%] [--r:12deg]",
    delay: 1.5,
  },
  {
    id: "astro",
    size: 72,
    placement: "left-[20%] top-[68%] [--r:160deg]",
    delay: 2.5,
  },
  {
    id: "nextjs",
    size: 72,
    placement: "left-[76%] top-[72%] [--r:-150deg]",
    delay: 3.5,
  },
  {
    id: "bun",
    size: 60,
    placement: "left-[6%] top-[56%] [--r:70deg]",
    delay: 0.8,
  },
  {
    id: "shadcn-ui",
    size: 60,
    placement: "left-[90%] top-[52%] [--r:-100deg]",
    delay: 2,
  },
  {
    id: "docker",
    size: 56,
    placement: "left-[36%] top-[84%] [--r:200deg]",
    delay: 3,
  },
  {
    id: "tailwindcss",
    size: 56,
    placement: "left-[62%] top-[86%] [--r:120deg]",
    delay: 1,
  },
  {
    id: "claude",
    size: 48,
    placement: "left-[14%] top-[36%] [--r:-30deg]",
    delay: 2.2,
  },
  {
    id: "linear",
    size: 48,
    placement: "left-[70%] top-[10%] [--r:25deg]",
    delay: 3.3,
  },
  {
    id: "playwright",
    size: 48,
    placement: "left-[48%] top-[6%] [--r:-20deg]",
    delay: 1.2,
  },
  {
    id: "prisma",
    size: 44,
    placement: "left-[92%] top-[82%] [--r:40deg]",
    delay: 0.3,
  },
];

/**
 * Every bob delay the 404 tiles use, in seconds.
 */
export const NOT_FOUND_DELAYS: readonly number[] = [
  ...new Set(NOT_FOUND_TILES.map((tile) => tile.delay)),
].toSorted((a, b) => a - b);

/**
 * Count of tools and tech the Uses page lists.
 * @param locale Language whose Uses data is counted.
 * @returns Tools plus tech badges.
 */
export function stackToolCount(locale: Locale): number {
  return uses[locale].tools.length + uses[locale].tech.length;
}
