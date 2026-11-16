export type Theme = "dark" | "light";
export type BannerFormat =
  | "og"
  | "x-header"
  | "linkedin-banner"
  | "youtube-banner"
  | "twitch-banner"
  | "twitch-offline";

export interface FormatSpec {
  width: number;
  height: number;
  maxBytes: number;
  headlineSize: number;
  minHeadlinePx: number;
  handleSize: number;
  wordmarkWidth: number;
  lines?: string[];
  handle?: string;
  safe?: { left: number; top: number; width: number; height: number };
  display: { desktop: number; phone: number };
  devices: { ghost: boolean; dimension: boolean };
}

export const KB: number;
export const MB: number;
export const MARK_SIZES: number[];
export const AVATAR_SIZE: number;
export const PANEL_WIDTH: number;
export const PANEL_HEIGHT: number;
export const PANEL_MAX_BYTES: number;
export const PANEL_LABELS: string[];
export const FORMATS: Record<BannerFormat, FormatSpec>;

export function effectiveSize(nativePx: number, scale: number): number;

export function headlineOnScreen(format: BannerFormat): {
  desktop: number;
  phone: number;
};

export function bannerHtml(options: {
  format: BannerFormat;
  theme: Theme;
  wordmarkSvg: string;
  fontFaces: string;
  locale?: "en" | "es";
}): string;

export function assertSpec(
  outPath: string,
  spec: { width: number; height: number; maxBytes: number },
  options?: { repositoryRoot?: string; log?: (message: string) => void },
): Promise<void>;

export function panelHtml(options: { label: string; fontFaces: string }): string;
