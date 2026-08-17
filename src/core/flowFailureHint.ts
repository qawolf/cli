import { extractMissingPackage } from "./errors.js";
import { runnerMessages } from "./messages/index.js";

/**
 * Guidance to print alongside a flow failure, or undefined when the failure
 * needs none. Every output mode renders the same hint from the same error text.
 */
export function flowFailureHint(
  errText: string,
  projectDir: string | undefined,
): string | undefined {
  const missingPackage = extractMissingPackage(errText);
  if (missingPackage === undefined) return undefined;
  return runnerMessages.moduleNotFoundHint(missingPackage, projectDir);
}
