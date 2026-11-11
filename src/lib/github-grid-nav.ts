const DAYS_PER_WEEK = 7;

/**
 * Resolves the cell the keyboard moves to inside the contribution grid, which
 * is laid out in columns of seven days.
 * @param current Index of the active cell.
 * @param key The pressed `KeyboardEvent.key`.
 * @param total Number of cells in the grid.
 * @returns The new index, or undefined when the key does not navigate.
 */
export function nextCellIndex(current: number, key: string, total: number): number | undefined {
  if (total <= 0) return undefined;
  const last = total - 1;
  const target: Record<string, number> = {
    ArrowDown: current + 1,
    ArrowUp: current - 1,
    ArrowRight: current + DAYS_PER_WEEK,
    ArrowLeft: current - DAYS_PER_WEEK,
    Home: 0,
    End: last,
  };
  const index = target[key];
  return index === undefined ? undefined : Math.min(last, Math.max(0, index));
}
