import type { Command } from "commander";

import { withContext } from "~/commands/context.js";
import { allEnvsNoEffectWarning } from "~/domains/flows/allEnvsWarning.js";
import { flowsMessages } from "~/core/messages/index.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { findPulledEnv } from "~/shell/manifest/pulledEnv.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleFlowsRun } from "./runDefaults.js";
import { handleHybridFlowsRun } from "./hybridRunDefaults.js";
import { withResolvedEnv } from "./withResolvedEnv.js";

type Opts = FlowsRunFlags & {
  env?: string;
  tag: string[];
  allEnvs?: boolean;
};

/** Dispatches `flows run` to the hybrid (--env) or the local handler. */
export function makeFlowsRunAction(signals: SignalRegistry) {
  return (
    pattern: string | undefined,
    opts: Opts,
    command: Command,
  ): Promise<void> => {
    const selectors = { tags: opts.tag };
    const allEnvsWarning = allEnvsNoEffectWarning({
      allEnvs: opts.allEnvs ?? false,
      env: opts.env,
      tags: opts.tag,
    });
    if (opts.env !== undefined) {
      // Resolution turns an alias into the canonical id before the
      // .qawolf/<env>/ cache lookup, so --env <alias> and --env <id>
      // share one cache directory.
      return withResolvedEnv(
        signals,
        {
          explicit: opts.env,
          requiredMessage: flowsMessages.run.requiresEnv,
          // A run whose flows are already pulled does not need the
          // platform, so an unreachable one should not stop it. The slug
          // recorded at pull time means an alias resolves here too.
          offlineFallback: async (explicit) =>
            explicit === undefined
              ? undefined
              : (await findPulledEnv(explicit, process.cwd()))?.envId,
        },
        (ctx, env, identity) => {
          if (allEnvsWarning !== undefined) ctx.ui.warn(allEnvsWarning);
          return handleHybridFlowsRun(
            ctx,
            pattern,
            { ...opts, env },
            { identity, selectors },
          );
        },
      )(opts, command);
    }
    return withContext(signals, (ctx) => {
      if (allEnvsWarning !== undefined) ctx.ui.warn(allEnvsWarning);
      return handleFlowsRun(
        ctx,
        pattern,
        opts,
        undefined,
        selectors,
        opts.allEnvs,
      );
    })(opts, command);
  };
}
