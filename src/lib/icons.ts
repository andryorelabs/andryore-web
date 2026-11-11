/**
 * Directory of the self-hosted logo files, as an `import.meta.glob` key prefix.
 */
export const ICON_DIRECTORY = "/src/assets/icons/";

interface IconEntry {
  readonly file: string;
  readonly dark?: string;
  readonly hex?: string;
}

/**
 * Every self-hosted brand icon by id. `dark` is the mark for dark surfaces and
 * `hex` the brand colour for badges and glows. Ids ending in `-mono` are
 * single-colour `currentColor` marks of a brand that also has a coloured logo.
 */
export const ICONS = {
  github: { file: "github.svg", dark: "github-dark.svg" },
  x: { file: "x.svg", dark: "x-dark.svg" },
  youtube: { file: "youtube.svg" },
  tiktok: { file: "tiktok.svg", dark: "tiktok-dark.svg" },
  instagram: { file: "instagram.svg" },
  twitch: { file: "twitch.svg" },
  discord: { file: "discord.svg" },
  linkedin: { file: "linkedin.svg" },
  typescript: { file: "typescript.svg" },
  bun: { file: "bun.svg" },
  astro: { file: "astro.svg", dark: "astro-dark.svg" },
  react: { file: "react.svg", dark: "react-dark.svg" },
  nextjs: { file: "nextjs.svg" },
  tailwindcss: { file: "tailwindcss.svg" },
  "shadcn-ui": { file: "shadcn-ui.svg", dark: "shadcn-ui-dark.svg" },
  "base-ui": { file: "base-ui.svg", dark: "base-ui-dark.svg" },
  prisma: { file: "prisma.svg", dark: "prisma-dark.svg" },
  postgresql: { file: "postgresql.svg" },
  supabase: { file: "supabase.svg" },
  zod: { file: "zod.svg" },
  tanstack: { file: "tanstack.svg", dark: "tanstack-dark.svg" },
  "better-auth": { file: "better-auth.svg", dark: "better-auth-dark.svg" },
  resend: { file: "resend.svg", dark: "resend-dark.svg" },
  posthog: { file: "posthog.svg" },
  remotion: { file: "remotion.svg" },
  turborepo: { file: "turborepo.svg", dark: "turborepo-dark.svg" },
  playwright: { file: "playwright.svg" },
  eslint: { file: "eslint.svg", dark: "eslint-dark.svg" },
  prettier: { file: "prettier.svg", dark: "prettier-dark.svg" },
  docker: { file: "docker.svg" },
  nginx: { file: "nginx.svg" },
  linear: { file: "linear.svg" },
  git: { file: "git.svg" },
  bitwarden: { file: "bitwarden.svg" },
  claude: { file: "claude.svg" },
  vue: { file: "vue.svg" },
  svelte: { file: "svelte.svg" },
  cloudflare: { file: "cloudflare.svg" },
  vercel: { file: "vercel.svg", dark: "vercel-dark.svg" },
  figma: { file: "figma.svg" },
  hono: { file: "hono.svg" },
  trpc: { file: "trpc.svg" },
  nodejs: { file: "nodejs.svg" },
  neon: { file: "neon.svg" },
  chrome: { file: "chrome.svg" },
  edge: { file: "edge.svg" },
  brave: { file: "brave.svg" },
  opera: { file: "opera.svg" },
  firefox: { file: "firefox.svg" },
  safari: { file: "safari.svg" },
  nushell: { file: "nushell.svg", hex: "#4e9a06" },
  starship: { file: "starship.svg", hex: "#dd0b78" },
  tailscale: { file: "tailscale.svg", hex: "#242424" },
  coolify: { file: "coolify.svg", hex: "#6b16ed" },
  wxt: { file: "wxt.svg", hex: "#67d55e" },
  "cloudflare-mono": { file: "cloudflare-mono.svg", hex: "#f38020" },
  "tanstack-mono": { file: "tanstack-mono.svg", hex: "#ece8d1" },
  "better-auth-mono": { file: "better-auth-mono.svg", hex: "#ffffff" },
  knip: { file: "knip.svg", hex: "#f56e0f" },
  dotenv: { file: "dotenv.svg", hex: "#ecd53f" },
  "posthog-mono": { file: "posthog-mono.svg", hex: "#000000" },
  "postgresql-mono": { file: "postgresql-mono.svg", hex: "#4169e1" },
  "turborepo-mono": { file: "turborepo-mono.svg", hex: "#ff1e56" },
  "github-actions": { file: "github-actions.svg", hex: "#2088ff" },
  "vercel-mono": { file: "vercel-mono.svg", hex: "#000000" },
  "figma-mono": { file: "figma-mono.svg", hex: "#f24e1e" },
  "hono-mono": { file: "hono-mono.svg", hex: "#e36002" },
  "trpc-mono": { file: "trpc-mono.svg", hex: "#2596be" },
  "nodejs-mono": { file: "nodejs-mono.svg", hex: "#5fa04e" },
  "neon-mono": { file: "neon-mono.svg", hex: "#34d59a" },
  "trigger-dev": { file: "trigger-dev.svg" },
  chezmoi: { file: "chezmoi.svg" },
  mise: { file: "mise.svg" },
  orca: { file: "orca.svg" },
  "ao-mark": { file: "ao-mark.svg", dark: "ao-mark-dark.svg" },
} as const satisfies Readonly<Record<string, IconEntry>>;

export type IconId = keyof typeof ICONS;

export interface ResolvedIcon {
  readonly light: string;
  readonly dark: string;
  readonly hex?: string;
}

/**
 * Resolves an icon id to the asset paths of its light and dark marks.
 * @param id A key of `ICONS`.
 * @returns Both paths; they are equal when the brand has a single mark.
 */
export function resolveIcon(id: IconId): ResolvedIcon {
  const entry: IconEntry = ICONS[id];
  return {
    light: `${ICON_DIRECTORY}${entry.file}`,
    dark: `${ICON_DIRECTORY}${entry.dark ?? entry.file}`,
    ...(entry.hex !== undefined && { hex: entry.hex }),
  };
}
