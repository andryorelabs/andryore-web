import type { Locale } from "../i18n/locales";

/**
One figure of the "In numbers" row.
 */
export interface NumberStat {
  key: "independent" | "snug" | "installs" | "contributions";
  label: string;
  display: string;
  /**
  The value the count-up animates to; absent for a year.
   */
  count?: number;
  suffix?: string;
}

/**
The About copy the figures are built from.
 */
export interface NumbersCopy {
  independentLabel: string;
  independentValue: string;
  snugLabel: string;
  snugUsers: number;
  installsLabel: string;
  contributionsLabel: string;
}

/**
The inputs that come from other data: JSON Flow's row and the GitHub grid.
 */
export interface NumbersSources {
  installs: { total: number };
  contributions: number | undefined;
}

/**
 * Builds the figures of the "In numbers" row. The contributions figure is the
 * GitHub grid total, so it is never typed by hand; it is left out when no
 * snapshot is available.
 * @param copy The About copy.
 * @param sources JSON Flow's installs and the GitHub grid total.
 * @param locale Language of the number format.
 * @returns The four figures, in display order.
 */
export function buildNumberStats(
  copy: NumbersCopy,
  sources: NumbersSources,
  locale: Locale,
): NumberStat[] {
  const format = (value: number): string =>
    new Intl.NumberFormat(locale, { useGrouping: "always" }).format(value);
  return [
    {
      key: "independent",
      label: copy.independentLabel,
      display: copy.independentValue,
    },
    {
      key: "snug",
      label: copy.snugLabel,
      display: format(copy.snugUsers),
      count: copy.snugUsers,
    },
    {
      key: "installs",
      label: copy.installsLabel,
      display: format(sources.installs.total),
      count: sources.installs.total,
      suffix: "+",
    },
    ...(sources.contributions === undefined
      ? []
      : [
          {
            key: "contributions" as const,
            label: copy.contributionsLabel,
            display: format(sources.contributions),
            count: sources.contributions,
          },
        ]),
  ];
}
