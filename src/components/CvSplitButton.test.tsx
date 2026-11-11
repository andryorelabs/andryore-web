import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import about from "../content/about.json";
import type { Locale } from "../i18n/locales";
import { CV_PATHS } from "../lib/contact";
import CvSplitButton from "./CvSplitButton";

const render = (locale: Locale): string =>
  renderToStaticMarkup(<CvSplitButton locale={locale} copy={about[locale]} />);

describe("CvSplitButton", () => {
  test("downloads the page language by default", () => {
    expect(render("en")).toContain(`href="${CV_PATHS.en}"`);
    expect(render("es")).toContain(`href="${CV_PATHS.es}"`);
  });

  test("names the file and the language for assistive technology", () => {
    const html = render("en");
    expect(html).toContain(`download="${about.en.cvEnglishFile}"`);
    expect(html).toContain(about.en.cvEnglishOption);
    expect(html).toContain(`aria-label="${about.en.cvMenuLabel}"`);
    expect(render("es")).toContain(`aria-label="${about.es.cvMenuLabel}"`);
  });

  test("plays the cv sound on the download only, the menu keeps the click", () => {
    const html = render("en");
    expect(html).toContain('data-sound="cv"');
    expect(html.match(/data-sound=/g)).toHaveLength(1);
  });

  test("shows the language of the file next to the label", () => {
    expect(render("en")).toContain("CV · EN");
    expect(render("es")).toContain("CV · ES");
  });

  test("labels the group and both file options like the canvas", () => {
    expect(about.en.cvGroupLabel).toBe("Download CV");
    expect(about.es.cvGroupLabel).toBe("Descargar CV");
    expect(about.en.cvEnglishOption).toBe("English (PDF)");
    expect(about.en.cvSpanishOption).toBe("Spanish (PDF)");
    expect(about.es.cvEnglishOption).toBe("Inglés (PDF)");
    expect(about.es.cvSpanishOption).toBe("Español (PDF)");
    expect(render("en")).toContain('aria-label="Download CV"');
  });

  test("tracks the download by language", () => {
    expect(render("es")).toContain('data-umami-event-language="es"');
  });
});
