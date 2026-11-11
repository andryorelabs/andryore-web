const LANGUAGES = ["en", "es"] as const;

const PAGE_PATHS = [
  "/",
  "/about/",
  "/uses/",
  "/products/snug/",
  "/products/animated-fluent-emojis/",
  "/products/json-flow/",
] as const;

/**
Every page route of the built Site, in English and Spanish.
 */
export const ROUTES: readonly string[] = LANGUAGES.flatMap((language) =>
  PAGE_PATHS.map((path) => (language === "en" ? path : `/es${path}`)),
);

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 375, height: 812 },
  narrow: { width: 320, height: 640 },
} as const;

/**
The phone widths the overflow checks run at.
 */
export const PHONE_WIDTHS = [320, 360, 375, 390, 412, 430] as const;

/**
Every page route plus the 404 page in each language.
 */
export const OVERFLOW_ROUTES: readonly string[] = [...ROUTES, "/does-not-exist/", "/es/404/"];
