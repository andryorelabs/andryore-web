import { existsSync } from "node:fs";
import { config } from "@dotenvx/dotenvx";

/**
 * Where the runtime image keeps the encrypted env file.
 */
const DEFAULT_ENV_FILE = ".env";

interface LoadEncryptedEnvironmentOptions {
  envFile?: string;
  env?: Record<string, string>;
}

/**
 * Decrypts the committed `.env` into the environment at startup (ADR 0022).
 * Without the file or `DOTENV_PRIVATE_KEY` it loads nothing and never throws,
 * so the endpoint behaves as it does when a credential is missing.
 * @param options The env file path and the target environment.
 * @returns Whether any variable was loaded.
 */
export function hasLoadedEncryptedEnvironment(
  options: LoadEncryptedEnvironmentOptions = {},
): boolean {
  const environmentFile = options.envFile ?? DEFAULT_ENV_FILE;
  const environment = options.env ?? (process.env as Record<string, string>);
  if (!environment.DOTENV_PRIVATE_KEY || !existsSync(environmentFile)) return false;
  try {
    const result = config({
      path: environmentFile,
      processEnv: environment,
      quiet: true,
      ignore: ["MISSING_ENV_FILE"],
    });
    return !result.error && Object.keys(result.parsed ?? {}).length > 0;
  } catch {
    return false;
  }
}
