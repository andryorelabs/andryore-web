const SOLID_PAINT = /\b(fill|stroke)="(?!none"|currentColor")[^"]*"/g;
const TYPESCRIPT_TILE = /<path d="M20 0h216[^"]*"[^>]*\/>/;

/**
 * Turns a brand logo into a bare glyph that follows the text colour: every
 * solid fill and stroke becomes `currentColor`, the TypeScript logo loses its
 * rounded tile, and the root gets an explicit size.
 * @param svg The raw logo markup.
 * @param size The width and height of the glyph in pixels.
 * @returns The recoloured markup, hidden from assistive technology.
 */
export function tintSvg(svg: string, size: number): string {
  return svg
    .replace(TYPESCRIPT_TILE, "")
    .replaceAll(SOLID_PAINT, '$1="currentColor"')
    .replace(/<svg\b/, (root) =>
      [
        root,
        `width="${String(size)}"`,
        `height="${String(size)}"`,
        'aria-hidden="true"',
        'focusable="false"',
      ].join(" "),
    );
}
