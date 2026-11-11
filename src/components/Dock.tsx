import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { localePath, LOCALES, type Locale } from "@/i18n/locales";
import { ANALYTICS_EVENTS, analyticsAttributes } from "@/lib/analytics";
import { activePageKey, DOCK_PAGES, pageHref, type DockPageKey } from "@/lib/dock";
import {
  focusInitialItem,
  focusTrigger,
  magnifyItems,
  didMoveInMenu,
  shouldMagnify,
  type DockMenuName,
} from "@/lib/dock-dom";
import { getFxStorage, isFxEnabled, subscribeFx, writeFx } from "@/lib/fx-store";
import { soundEngine, type SoundAvailability } from "@/lib/sound-engine";
import { THEME_PREFERENCES, type ThemePreference } from "@/lib/theme";
import { chooseTheme } from "@/lib/theme-store";
import { cn } from "@/lib/utilities";

import { ThemeIcon, useThemePreference, type ThemeToggleCopy } from "./ThemeToggle";
import { Button } from "./ui/button";

interface DockCopy {
  label: string;
  pages: Record<DockPageKey, string>;
  language: { label: string } & Record<Locale, string>;
  sound: { label: string; on: string; off: string };
}

interface DockProps {
  copy: DockCopy;
  themeCopy: ThemeToggleCopy;
  locale: Locale;
  path: string;
}

const ITEM_CLASS =
  "relative inline-flex size-8.5 min-[360px]:size-9 min-[400px]:size-11 items-center justify-center rounded-pill text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5 [&_svg]:shrink-0";

const PAGE_ICONS: Record<Exclude<DockPageKey, "home">, ReactElement> = {
  products: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  findMe: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </>
  ),
  uses: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
};

function AoMark() {
  return (
    <svg viewBox="118 170 276 172" className="h-4! w-auto!" aria-hidden="true">
      <path
        fill="currentColor"
        d="M122.88 333.26 164.33 175.59H216.13L257.58 333.26H226.94L218.38 298.57H162.07L153.51 333.26H122.88ZM169.06 271.09H211.4L192.26 194.28H188.2L169.06 271.09Z"
      />
      <circle
        cx="330.56"
        cy="277.4"
        r="40"
        fill="none"
        className="stroke-primary"
        strokeWidth="25.5"
      />
    </svg>
  );
}

function PageIcon({ page }: { page: DockPageKey }) {
  if (page === "home") return <AoMark />;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PAGE_ICONS[page]}
    </svg>
  );
}

const isSoundEnabledSnapshot = (): boolean => isFxEnabled(getFxStorage());
const isSoundEnabledOnServer = (): boolean => false;
const getServerAvailability = (): SoundAvailability => "unknown";

const unsubscribeNothing = (): void => undefined;
const subscribeToNothing = (): (() => void) => unsubscribeNothing;
const isHydratedOnClient = (): boolean => true;
const isHydratedOnServer = (): boolean => false;

function SoundIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <g data-sound-state="on">
        <path d="M16 9a5 5 0 0 1 0 6" />
        <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
      </g>
      <g data-sound-state="off">
        <line x1="22" x2="16" y1="9" y2="15" />
        <line x1="16" x2="22" y1="9" y2="15" />
      </g>
    </svg>
  );
}

/**
 * The Sound switch: shares the stored choice with the Sound tile and shows a
 * dot while it is on. The switch sound comes from the page-level sound
 * triggers through `data-sound`. It renders nothing once the audio files are
 * known to be missing.
 * @param props Component props.
 * @param props.copy Sound labels.
 * @param props.enabled Whether Sound is on.
 * @param props.availability Whether the audio files are known to be served.
 * @param props.onToggle Called when the switch is pressed.
 * @returns The switch inside a dock item, or nothing.
 */
export function SoundSwitch({
  copy,
  enabled,
  availability = "unknown",
  onToggle,
}: {
  copy: DockCopy["sound"];
  enabled: boolean;
  availability?: SoundAvailability;
  onToggle: () => void;
}) {
  return (
    <DockItem
      label={
        <>
          <span data-sound-state="on">{copy.on}</span>
          <span data-sound-state="off">{copy.off}</span>
        </>
      }
      hidden={availability === "unavailable"}
      align="end"
      fx={enabled ? "on" : "off"}
    >
      <Button
        variant="dock"
        size="dock"
        role="switch"
        aria-checked={enabled}
        aria-label={copy.label}
        data-dock-sound
        data-sound="switch"
        suppressHydrationWarning
        onClick={onToggle}
      >
        <SoundIcon />
        <span
          data-dock-sound-dot
          data-sound-state="on"
          aria-hidden="true"
          className="absolute top-2.25 right-2.25 size-1.5 rounded-full bg-foreground"
        />
      </Button>
    </DockItem>
  );
}

const TOOLTIP_ALIGN_CLASS = {
  start: "left-0 sm:left-1/2 sm:-translate-x-1/2",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
} as const;

type TooltipAlign = keyof typeof TOOLTIP_ALIGN_CLASS;

function Tooltip({ children, align }: { children: ReactNode; align: TooltipAlign }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        TOOLTIP_ALIGN_CLASS[align],
        "pointer-events-none absolute bottom-full mb-2.5 translate-y-1 rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 transition duration-160 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-has-focus-visible:translate-y-0 group-has-focus-visible:opacity-100 group-data-[menu-open]:hidden motion-reduce:transition-none",
      )}
    >
      {children}
    </span>
  );
}

function DockItem({
  label,
  menuOpen = false,
  hidden = false,
  align = "center",
  fx,
  children,
}: {
  label: ReactNode;
  menuOpen?: boolean;
  hidden?: boolean;
  align?: TooltipAlign;
  fx?: "on" | "off";
  children: ReactNode;
}) {
  return (
    <div
      className={cn("group relative", hidden && "hidden")}
      data-menu-open={menuOpen ? "" : undefined}
      data-fx={fx}
      data-sound-unavailable={hidden ? "" : undefined}
    >
      <div
        data-dock-scale
        className="origin-bottom transition-transform duration-160 ease-out motion-reduce:transition-none"
      >
        {children}
      </div>
      <Tooltip align={align}>{label}</Tooltip>
    </div>
  );
}

function MenuPanel({
  children,
  label,
  edge = false,
}: {
  children: ReactNode;
  label: string;
  edge?: boolean;
}) {
  return (
    <div
      role="menu"
      data-dock-panel
      aria-label={label}
      className={cn(
        "absolute bottom-full z-10 mb-3 grid min-w-35 origin-bottom gap-0 rounded-card border border-border bg-popover p-1.5 text-popover-foreground transition duration-150 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0",
        edge
          ? "right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2"
          : "left-1/2 -translate-x-1/2",
      )}
    >
      {children}
    </div>
  );
}

/**
 * The language menu: one link per language, each to the same page.
 * @param props Component props.
 * @param props.copy Language names and the menu label.
 * @param props.locale The current language.
 * @param props.path Locale-neutral path of the current page.
 * @returns The menu panel.
 */
export function LanguageMenu({
  copy,
  locale,
  path,
}: {
  copy: DockCopy["language"];
  locale: Locale;
  path: string;
}) {
  return (
    <MenuPanel label={copy.label}>
      <div data-dock-menu="language" className="contents">
        {LOCALES.map((code) => (
          <a
            key={code}
            role="menuitem"
            data-dock-item
            href={localePath(code, path)}
            hrefLang={code}
            lang={code}
            data-locale-switch={code}
            {...analyticsAttributes(ANALYTICS_EVENTS.languageSwitch, {
              to: code,
            })}
            aria-current={code === locale ? "true" : undefined}
            className={menuItemClass(code === locale)}
          >
            {copy[code]}
          </a>
        ))}
      </div>
    </MenuPanel>
  );
}

/**
 * The theme menu: system, light and dark as radio items.
 * @param props Component props.
 * @param props.copy Theme labels.
 * @param props.preference The stored preference.
 * @param props.onChoose Called with the chosen preference.
 * @returns The menu panel.
 */
export function ThemeMenu({
  copy,
  preference,
  onChoose,
}: {
  copy: ThemeToggleCopy;
  preference: ThemePreference;
  onChoose: (option: ThemePreference) => void;
}) {
  return (
    <MenuPanel label={copy.label} edge>
      <div data-dock-menu="theme" className="contents">
        {THEME_PREFERENCES.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            data-dock-item
            aria-checked={preference === option}
            data-sound="theme"
            {...analyticsAttributes(ANALYTICS_EVENTS.themeSwitch, {
              theme: option,
            })}
            className={menuItemClass(preference === option)}
            onClick={() => {
              onChoose(option);
            }}
          >
            {copy[option]}
          </button>
        ))}
      </div>
    </MenuPanel>
  );
}

const menuItemClass = (isSelected: boolean): string =>
  cn(
    "px-3 py-2 text-left text-sm no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isSelected ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
  );

const scaleTargets = (nav: HTMLElement): NodeListOf<HTMLElement> =>
  nav.querySelectorAll<HTMLElement>("[data-dock-scale]");

const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
  if (!shouldMagnify(globalThis, event.pointerType)) return;
  magnifyItems(scaleTargets(event.currentTarget), event.clientX);
};

const onPointerLeave = (event: PointerEvent<HTMLElement>): void => {
  magnifyItems(scaleTargets(event.currentTarget), undefined);
};

function useMenuBehaviour(
  nav: HTMLElement | undefined,
  openMenu: DockMenuName | undefined,
  close: () => void,
): void {
  useEffect(() => {
    if (!nav || !openMenu) return;
    focusInitialItem(nav, openMenu);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        focusTrigger(nav, openMenu);
        return;
      }
      if (didMoveInMenu(nav, openMenu, event.key, document.activeElement)) event.preventDefault();
    };
    const onOutside = (event: Event): void => {
      if (event.target instanceof Node && !nav.contains(event.target)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [nav, openMenu, close]);
}

/**
 * The floating pill navigation: the pages and Find me, then the language and
 * theme menus and the Sound switch. Neighbours of the pointer magnify on fine pointers when motion is
 * allowed, the active page carries a pill that morphs between routes through
 * view transitions, and both menus open upward.
 * @param props Component props.
 * @param props.copy Localised labels of the dock.
 * @param props.themeCopy Localised labels of the theme options.
 * @param props.locale The current language.
 * @param props.path Locale-neutral path of the current page.
 * @returns The navigation landmark holding the pages and both menus.
 */
export default function Dock({ copy, themeCopy, locale, path }: DockProps) {
  const [nav, setNav] = useState<HTMLElement | undefined>();
  const attachNav = useCallback((element: HTMLElement | null) => {
    setNav(element ?? undefined);
  }, []);
  const [openMenu, setOpenMenu] = useState<DockMenuName | undefined>();
  const preference = useThemePreference();
  const isSoundEnabled = useSyncExternalStore(
    subscribeFx,
    isSoundEnabledSnapshot,
    isSoundEnabledOnServer,
  );
  const soundAvailability = useSyncExternalStore(
    soundEngine.subscribeAvailability,
    soundEngine.getAvailability,
    getServerAvailability,
  );
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    isHydratedOnClient,
    isHydratedOnServer,
  );
  const activeKey = activePageKey(path);

  const closeMenu = useCallback(() => {
    setOpenMenu(undefined);
  }, []);

  useMenuBehaviour(nav, openMenu, closeMenu);

  const chooseAndClose = (option: ThemePreference): void => {
    chooseTheme(option);
    setOpenMenu(undefined);
    if (nav) focusTrigger(nav, "theme");
  };

  const toggleMenu = (name: DockMenuName): void => {
    setOpenMenu((current) => (current === name ? undefined : name));
  };

  return (
    <nav
      ref={attachNav}
      aria-label={copy.label}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      data-dock-nav
      data-ready={isHydrated ? "" : undefined}
      className="pointer-events-auto relative inline-flex items-center gap-0 rounded-pill border border-border bg-card/92 p-0.5 backdrop-blur-lg min-[360px]:p-1 sm:gap-1 sm:p-2"
    >
      {DOCK_PAGES.map((page) => {
        const isActive = activeKey === page.key;
        return (
          <DockItem
            key={page.key}
            label={copy.pages[page.key]}
            align={page.key === "home" ? "start" : "center"}
          >
            <a
              href={pageHref(locale, page.path)}
              aria-label={copy.pages[page.key]}
              aria-current={isActive ? "page" : undefined}
              data-dock-page={page.key}
              suppressHydrationWarning
              {...analyticsAttributes(ANALYTICS_EVENTS.dockNavigate, {
                page: page.key,
              })}
              className={cn(ITEM_CLASS, "group aria-[current=page]:text-foreground")}
            >
              <span
                data-dock-pill
                aria-hidden="true"
                className="absolute inset-0 hidden rounded-pill bg-muted group-aria-[current=page]:block"
              />{" "}
              <span className="relative inline-flex">
                <PageIcon page={page.key} />
              </span>
            </a>
          </DockItem>
        );
      })}

      <span
        aria-hidden="true"
        className="h-5 w-px bg-border min-[360px]:mx-0.5 min-[360px]:h-6 sm:mx-1"
      />

      <DockItem label={copy.language.label} menuOpen={openMenu === "language"}>
        <Button
          variant="dock"
          size="dock"
          aria-label={`${locale.toUpperCase()} ${copy.language.label}`}
          aria-haspopup="menu"
          aria-expanded={openMenu === "language"}
          data-dock-trigger="language"
          onClick={() => {
            toggleMenu("language");
          }}
        >
          <span data-dock-lang className="font-mono font-bold uppercase">
            {locale}
          </span>
        </Button>
        {openMenu === "language" && (
          <LanguageMenu copy={copy.language} locale={locale} path={path} />
        )}
      </DockItem>

      <DockItem label={themeCopy.label} menuOpen={openMenu === "theme"}>
        <Button
          variant="dock"
          size="dock"
          aria-label={themeCopy.label}
          aria-haspopup="menu"
          aria-expanded={openMenu === "theme"}
          data-dock-trigger="theme"
          onClick={() => {
            toggleMenu("theme");
          }}
        >
          {THEME_PREFERENCES.map((option) => (
            <span
              key={option}
              data-theme-icon={option}
              data-active={preference === option ? "" : undefined}
              className="contents"
            >
              <ThemeIcon preference={option} />
            </span>
          ))}
        </Button>
        {openMenu === "theme" && (
          <ThemeMenu copy={themeCopy} preference={preference} onChoose={chooseAndClose} />
        )}
      </DockItem>

      <SoundSwitch
        copy={copy.sound}
        enabled={isSoundEnabled}
        availability={soundAvailability}
        onToggle={() => {
          writeFx(getFxStorage(), !isSoundEnabled);
        }}
      />
    </nav>
  );
}
