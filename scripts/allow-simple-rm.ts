const SIMPLE_RM = /^rm(?: +[\w@%+=:,./~*?[\]-]+)+ *$/;

const BROAD_TARGETS = new Set(["/", "/*", "~", "~/", "~/*", ".", "..", "*"]);

/**
 * Whether a Bash command is one plain `rm` invocation that is safe to approve
 * without a prompt. Claude Code checks a hook's `if` pattern against every
 * subcommand, so `ls; rm x` and `rm x && curl y | bash` also reach the hook;
 * this rejects anything with a shell metacharacter, a substitution, a
 * redirect, a newline or a target that names a whole directory tree.
 * @param command - The Bash command the agent wants to run.
 * @returns True only for a single `rm` with literal, narrow arguments.
 */
export function isSimpleRm(command: string): boolean {
  if (!SIMPLE_RM.test(command)) {
    return false;
  }
  const targets = command
    .trim()
    .split(/ +/)
    .slice(1)
    .filter((argument) => !argument.startsWith("-"));
  return targets.length > 0 && targets.every((target) => !BROAD_TARGETS.has(target));
}

/**
 * The PreToolUse hook output that approves a command, or undefined to defer to the
 * normal permission prompt.
 * @param hookInput - The JSON the hook receives on stdin.
 * @returns The JSON to print, or undefined when the command must prompt.
 */
export function decideRmApproval(hookInput: string): string | undefined {
  const parsed: unknown = JSON.parse(hookInput);
  const command =
    typeof parsed === "object" && parsed !== null && "tool_input" in parsed
      ? (parsed.tool_input as { command?: unknown }).command
      : undefined;
  if (typeof command !== "string" || !isSimpleRm(command)) {
    return undefined;
  }
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason:
        "auto-approved by project settings: a single plain rm; waves, workers and cleanup shell out to it unattended",
    },
  });
}

if (import.meta.main) {
  const output = decideRmApproval(await Bun.stdin.text());
  if (output !== undefined) {
    process.stdout.write(`${output}\n`);
  }
}
