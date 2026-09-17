import { extractMissingSpecifier } from "./errors.js";
import { runnerMessages } from "./messages/index.js";

/** Every output mode renders the same hint from the same error text. */
export function flowFailureHint(
  errText: string,
  projectDir: string | undefined,
): string | undefined {
  const missing = extractMissingSpecifier(errText);
  if (missing === undefined) return undefined;
  return missing.kind === "path-alias"
    ? runnerMessages.pathAliasNotFoundHint(missing.specifier, projectDir)
    : runnerMessages.moduleNotFoundHint(missing.specifier, projectDir);
}
