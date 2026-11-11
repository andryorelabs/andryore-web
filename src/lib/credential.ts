const ENCRYPTED_PREFIX = "encrypted:";

/**
 * Reads a credential from the environment, ignoring dotenvx ciphertext. Bun
 * autoloads a committed `.env`, so a checkout without `DOTENV_PRIVATE_KEY`
 * sees `encrypted:...` as the value (ADR 0022); treating it as absent keeps
 * keyless builds on their fallbacks instead of sending it to an API.
 * @param value The raw environment value.
 * @returns The trimmed credential, or undefined when it is missing or encrypted.
 */
export function usableCredential(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return !trimmed || trimmed.startsWith(ENCRYPTED_PREFIX) ? undefined : trimmed;
}
