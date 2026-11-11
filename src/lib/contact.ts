/**
Contact email shown on the About page and in the footer.
 */
export const CONTACT_EMAIL = "hello@andryore.dev";

/**
Public paths of the committed CV PDFs, one per language.
 */
export const CV_PATHS = {
  en: "/cv/andry-orellana-cv-en.pdf",
  es: "/cv/andry-orellana-cv-es.pdf",
} as const;

/**
Outcome of a copy attempt.
 */
export type CopyOutcome = "copied" | "selected";

/**
The browser capabilities a copy attempt uses, injected for testing.
 */
export interface CopyDependencies {
  writeText?: (text: string) => Promise<void>;
  selectText: () => void;
}

/**
 * Copies text to the clipboard and falls back to selecting it when the
 * clipboard is unavailable or refuses, so the visitor can press Ctrl+C.
 * @param text The text to copy.
 * @param dependencies Clipboard writer (optional) and a selection fallback.
 * @returns `copied` when the clipboard took it, `selected` otherwise.
 */
export async function copyWithFallback(
  text: string,
  dependencies: CopyDependencies,
): Promise<CopyOutcome> {
  if (dependencies.writeText) {
    try {
      await dependencies.writeText(text);
      return "copied";
    } catch {
      dependencies.selectText();
      return "selected";
    }
  }
  dependencies.selectText();
  return "selected";
}
