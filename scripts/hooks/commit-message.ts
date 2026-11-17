/**
 * Builds the commitlint invocation for a commit message file.
 * @param messageFile - The path git passes to the commit-msg hook.
 * @returns The command and arguments to spawn.
 */
export function buildCommitlintCommand(messageFile: string): string[] {
  return ["bunx", "commitlint", "--edit", messageFile];
}

/**
 * Runs a command with inherited output.
 * @param command - The command and arguments to spawn.
 * @returns The exit code of the spawned process.
 */
export function runCommand(command: string[]): number {
  return Bun.spawnSync(command, { stdout: "inherit", stderr: "inherit" }).exitCode;
}

/**
 * Hook entry point: lints the commit message file.
 * @param messageFile - The path git passes to the commit-msg hook.
 * @param run - Spawns the commitlint command, injectable for tests.
 * @returns The commitlint exit code, or 1 when no file was given.
 */
export function main(messageFile: string | undefined, run = runCommand): number {
  if (messageFile === undefined) {
    console.error("commit-msg: missing the commit message file argument");
    return 1;
  }
  return run(buildCommitlintCommand(messageFile));
}

if (import.meta.main) process.exitCode = main(Bun.argv[2]);
