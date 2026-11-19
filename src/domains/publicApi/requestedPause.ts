import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { triggerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";

import type { CommandSpec } from "./commandSpecs.js";

const contractsThatTakeAPause: ReadonlySet<string> = new Set([
  "trigger.create",
  "trigger.update",
]);

const reportedTrigger = z.object({
  trigger: z.object({
    id: z.string(),
    isPaused: z.boolean(),
    url: z.string().optional(),
  }),
});

const askedForPause = (spec: CommandSpec, input: unknown): boolean =>
  contractsThatTakeAPause.has(spec.contract.name) &&
  z.object({ isPaused: z.literal(true) }).safeParse(input).success;

export async function enforceRequestedPause(
  ctx: AuthCommandContext,
  spec: CommandSpec,
  input: unknown,
  output: unknown,
): Promise<CommandResult> {
  if (!askedForPause(spec, input)) return undefined;

  const write = {
    baseUrl: ctx.apiBaseUrl,
    command: spec.commandPath.join(" "),
  };
  const { trigger } = reportedTrigger.parse(output);
  if (trigger.isPaused) return undefined;

  const paused = await ctx.platformClient.callPublicApi(
    publicContractsV1.trigger.pause,
    { triggerId: trigger.id },
  );
  if (paused.ok && paused.value.trigger.isPaused) {
    return triggerMessages.pausedAfterwards({
      ...write,
      triggerId: trigger.id,
    });
  }
  return triggerMessages.leftLive({
    ...write,
    reason: paused.ok ? "the server still reports it running." : paused.error,
    triggerId: trigger.id,
    url: trigger.url,
  });
}
