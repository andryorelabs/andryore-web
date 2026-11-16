# Configuration

Every environment variable the Site reads, and how the encrypted env files work.
The decision and its risks are in
[ADR 0022](adr/0022-secrets-in-dotenvx-encrypted-env-files.md). The plain-text
list of names is [`.env.example`](../.env.example).

## Variables

| Name                   | When              | Secret | Required | When missing                                                                                          |
| ---------------------- | ----------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------- |
| `TWITCH_CLIENT_ID`     | Runtime           | No     | No       | The live status endpoint reports the unavailable state and the stream tile shows its fallback.        |
| `TWITCH_CLIENT_SECRET` | Runtime           | Yes    | No       | Same as above.                                                                                        |
| `GITHUB_TOKEN`         | Build and runtime | Yes    | No       | The build keeps the committed `src/content/github-grid.json`; the runtime endpoint has no data.       |
| `SOUNDS_TOKEN`         | Build             | Yes    | No       | `fetch-sounds` skips quietly and the Site hides the Sound switch.                                     |
| `SOUNDS_REPO`          | Build             | No     | No       | Dockerfile argument, default `AndryOre/andryore-private`. Required by the script once a token exists. |
| `SOUNDS_REF`           | Build             | No     | No       | Dockerfile argument, default `main`; a blank value also means `main`.                                 |
| `PORT`                 | Runtime           | No     | No       | The endpoint server listens on `3000`. The entrypoint sets it, so leave it alone.                     |
| `SITE_LASTMOD`         | Build             | No     | No       | The sitemap `lastmod` falls back to the UTC build date. Only a `YYYY-MM-DD` value is used.            |
| `DOTENV_PRIVATE_KEY`   | Build and runtime | Yes    | No       | dotenvx cannot decrypt `.env`; the credentials above count as missing.                                |

"Build" means the Docker build or a local `bun run build`; "runtime" means the
endpoint server inside the image. A blank value, or an `encrypted:` value that
nothing decrypted, counts as missing. Variables outside the Site (`CHROME_PATH`,
`E2E_PORT`, `E2E_BASE_URL`, `AUDIT_BASE_URL`, `FIDELITY_CANVAS`,
`SMOKE_BASE_URL`, `PLAYWRIGHT_PREVIEW_COMMAND`, `PARITY_CORPUS`) only tune test
and audit tooling, and `CI` and `GITHUB_STEP_SUMMARY` are set by GitHub Actions;
see [Development](development.md). A test
(`scripts/environment-documentation.test.ts`) fails when code reads a variable that this
page does not name.

## dotenvx workflow

- `.env` holds the production values, encrypted with dotenvx and committed. Its
  key is `DOTENV_PRIVATE_KEY`.
- `.env.keys` holds the private key. Git and Docker ignore it, and a pre-commit
  guard refuses it. There is no `.env.development`: the `dev` script does not
  load dotenvx.
- Coolify holds one value, `DOTENV_PRIVATE_KEY`, with Docker Build Secrets on so
  the build receives it as a BuildKit secret. It is the only variable to add
  there.

Never print or decrypt values in logs, tickets or commits.

### Encrypt and edit

1. Put a plaintext value in the file, for example `GITHUB_TOKEN=...` in `.env`.
2. Run `bun run env:encrypt`. dotenvx replaces plaintext values with
   `encrypted:` ones and writes the key to `.env.keys` on the first run.
3. Commit the env file. The pre-commit guard refuses a commit that still has a
   plaintext value or that stages `.env.keys`.

To change one value, set the new plaintext value on its line and encrypt again.

### Rotate

The ciphertext stays in public history, so rotating means replacing the
credentials themselves, not only the key:

1. Revoke and reissue the Twitch secret and the GitHub and sounds tokens.
2. Replace the values in `.env` and run `bun run env:encrypt`. To also replace
   the key, delete the `DOTENV_PRIVATE_KEY` line from `.env.keys` and the
   `DOTENV_PUBLIC_KEY` line from `.env` first, so dotenvx makes a new pair.
3. Update `DOTENV_PRIVATE_KEY` in Coolify, then redeploy.
4. Back up the new `.env.keys`.

### Back up `.env.keys`

`.env.keys` exists only on the machine that encrypted. Keep a copy in a password
manager. Losing it means re-creating every credential and re-encrypting.

### Keyless clones

A fresh clone has no `.env.keys`, and none is needed: `dev`, `build`, `preview`,
`test` and `check` run without it. The build uses the committed grid snapshot,
hides the Sound switch and the endpoints report no data. Bun autoloads `.env`,
so a keyless clone sees the ciphertext; `usableCredential`
(`src/lib/credential.ts`) ignores any value that starts with `encrypted:`, so it
counts as missing. Only a Docker build for production needs the key. If a
command asks for one, see
[Troubleshooting](troubleshooting.md#cannot-decrypt-env).
