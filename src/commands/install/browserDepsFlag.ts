import type { Command } from "commander";

/**
 * Resolves --no-browser-deps for a subcommand whose parent registers the same
 * flag. Commander's default parsing lets the parent consume the flag even when
 * it is written after the subcommand name, leaving the subcommand's own opts at
 * the default. The flag is negation-only, so ANDing both scopes is exact.
 */
export function mergedBrowserDeps(local: boolean, command: Command): boolean {
  const parent = command.parent?.opts<{ browserDeps?: boolean }>().browserDeps;
  return local && parent !== false;
}
