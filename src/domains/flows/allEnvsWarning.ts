import { flowsMessages } from "~/core/messages/index.js";

/**
 * The warning to show when --all-envs cannot affect the run, or undefined
 * when the flag has work to do.
 *
 * With --env the run is already pinned to one environment; without --tag no
 * selection can span several. Saying so beats silently ignoring the flag.
 */
export function allEnvsNoEffectWarning(args: {
  readonly allEnvs: boolean;
  readonly env: string | undefined;
  readonly tags: readonly string[];
}): string | undefined {
  if (!args.allEnvs) return undefined;
  if (args.env !== undefined) return flowsMessages.selectors.allEnvsWithEnv;
  if (args.tags.length === 0) return flowsMessages.selectors.allEnvsWithoutTag;
  return undefined;
}
