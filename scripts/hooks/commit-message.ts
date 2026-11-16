/**
 * Builds the commitlint invocation for a commit message file.
 * @param messageFile - The path git passes to the commit-msg hook.
 * @returns The command and arguments to spawn.
 */
export function buildCommitlintCommand(messageFile: string): string[] {
  return ["bunx", "commitlint", "--edit", messageFile];
}

/**
 * Hook entry point: lints the commit message file.
 * @param messageFile - The path git passes to the commit-msg hook.
 * @returns The commitlint exit code, or 1 when no file was given.
 */
export function main(messageFile: string | undefined): number {
  if (messageFile === undefined) {
    console.error("commit-msg: missing the commit message file argument");
    return 1;
  }
  const completed = Bun.spawnSync(buildCommitlintCommand(messageFile), {
    stdout: "inherit",
    stderr: "inherit",
  });
  return completed.exitCode;
}

if (import.meta.main) process.exitCode = main(Bun.argv[2]);
