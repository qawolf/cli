import {
  maxAgentWaitSeconds,
  publicContractsV1,
} from "@qawolf/api-contracts/v1";

import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

const answerMarginMs = 15_000;

export function holdWithin(remainingMs: number): {
  timeoutMs: number;
  waitSeconds: number;
} {
  const waitSeconds = Math.min(
    maxAgentWaitSeconds,
    Math.max(1, Math.ceil(remainingMs / 1_000)),
  );
  return { timeoutMs: waitSeconds * 1_000 + answerMarginMs, waitSeconds };
}

type Wake = { type: "activity" } | { type: "ended"; result: CommandResult };

export async function waitForActivity(
  ctx: AuthCommandContext,
  options: {
    cursor: string;
    remainingMs: () => number;
    sessionId: string;
    timeoutSeconds: number;
  },
): Promise<Wake> {
  for (;;) {
    const remainingMs = options.remainingMs();
    if (remainingMs <= 0) {
      return {
        result: {
          error: agentMessages.followTimedOut(
            options.sessionId,
            options.timeoutSeconds,
          ),
          exitCode: exitCodes.timeout,
        },
        type: "ended",
      };
    }
    const hold = holdWithin(remainingMs);
    const held = await ctx.platformClient.callPublicApi(
      publicContractsV1.agent.get,
      {
        cursor: options.cursor,
        sessionId: options.sessionId,
        waitSeconds: hold.waitSeconds,
      },
      { timeoutMs: hold.timeoutMs },
    );
    if (!held.ok) {
      return {
        result: { exitCode: exitCodes.network, ...failureFields(held) },
        type: "ended",
      };
    }
    if (held.value.wokeOn !== "timeout") return { type: "activity" };
  }
}
