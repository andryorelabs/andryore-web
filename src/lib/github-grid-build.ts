import { usableCredential } from "./credential";
import { GITHUB_LOGIN } from "./github-contributions";
import { resolveGridSnapshot, type GridSnapshot } from "./github-grid";

const committedSnapshots = import.meta.glob<GridSnapshot>("../content/github-grid.json", {
  eager: true,
  import: "default",
});

/**
 * Snapshot for the home GitHub tile, resolved at build time. The token comes
 * from `GITHUB_TOKEN` in the build environment and is never committed; a
 * missing token or an API error falls back to `src/content/github-grid.json`
 * when it exists, and otherwise returns undefined so the tile is not rendered.
 * @returns The snapshot to render, or undefined to hide the tile.
 */
export function loadGridSnapshot(): Promise<GridSnapshot | undefined> {
  return resolveGridSnapshot({
    token: usableCredential(process.env.GITHUB_TOKEN),
    login: GITHUB_LOGIN,
    now: new Date(),
    fetchImpl: (url, init) => fetch(url, init),
    committed: Object.values(committedSnapshots)[0] ?? undefined,
  });
}
