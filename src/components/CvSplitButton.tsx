import { ChevronDownIcon, DownloadIcon } from "lucide-react";
import { useSyncExternalStore, type ReactElement } from "react";

import { LOCALES, type Locale } from "@/i18n/locales";
import { ANALYTICS_EVENTS, analyticsAttributes } from "@/lib/analytics";
import { CV_PATHS } from "@/lib/contact";
import { createCvChoiceStore } from "@/lib/cv-preference";

import { Button, buttonClassName } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/**
 * Labels and file names of the CV split button.
 */
interface CvSplitButtonCopy {
  cvLabel: string;
  cvGroupLabel: string;
  cvMenuLabel: string;
  cvFileTag: string;
  cvEnglishOption: string;
  cvSpanishOption: string;
  cvEnglishFile: string;
  cvSpanishFile: string;
}

interface CvSplitButtonProps {
  locale: Locale;
  copy: CvSplitButtonCopy;
}

const choiceStore = createCvChoiceStore(globalThis);

/**
 * Split button that downloads the CV in the remembered language and lets the
 * visitor pick the other one from a menu. The page language is the default;
 * the choice persists in local storage, with the session store as fallback.
 * @param props The page language and the labels.
 * @param props.locale The page language, used until a choice is remembered.
 * @param props.copy Labels and file names.
 * @returns The button group.
 */
export default function CvSplitButton({ locale, copy }: CvSplitButtonProps): ReactElement {
  const language = useSyncExternalStore(
    choiceStore.subscribe,
    () => choiceStore.read(locale),
    () => locale,
  );

  const options = {
    en: { label: copy.cvEnglishOption, file: copy.cvEnglishFile },
    es: { label: copy.cvSpanishOption, file: copy.cvSpanishFile },
  } as const;

  return (
    <ButtonGroup aria-label={copy.cvGroupLabel} data-cv-split>
      <a
        href={CV_PATHS[language]}
        download={options[language].file}
        hrefLang={language}
        type="application/pdf"
        data-cv-download
        data-sound="cv"
        {...analyticsAttributes(ANALYTICS_EVENTS.cvDownload, { language })}
        className={buttonClassName("neutral", "cta", "border-r-0")}
      >
        <DownloadIcon aria-hidden="true" strokeWidth={1.8} />
        {`${copy.cvLabel} · ${language.toUpperCase()}`}
        <span className="sr-only">{options[language].label}</span>
      </a>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="neutral" size="icon" aria-label={copy.cvMenuLabel} data-cv-menu-trigger>
            <ChevronDownIcon aria-hidden="true" strokeWidth={1.8} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={language} onValueChange={choiceStore.choose}>
            {LOCALES.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                lang={option}
                data-cv-option={option}
              >
                {options[option].label}
                <span aria-hidden="true">{copy.cvFileTag}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
