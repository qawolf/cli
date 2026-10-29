import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";

import {
  type Deadline,
  type Ended,
  holdWithinDeadline,
  readWithinDeadline,
} from "./withinDeadline.js";

export function readSession(
  ctx: AuthCommandContext,
  deadline: Deadline,
  sessionId: string,
) {
  return readWithinDeadline(deadline, (plan) =>
    ctx.platformClient.callPublicApi(
      publicContractsV1.agent.get,
      { sessionId, waitSeconds: 0 },
      plan.requestOptions,
    ),
  );
}

export async function waitForActivity(
  ctx: AuthCommandContext,
  deadline: Deadline,
  options: { cursor: string; sessionId: string },
): Promise<{ type: "activity" } | Ended> {
  for (;;) {
    const held = await holdWithinDeadline(deadline, (plan) =>
      ctx.platformClient.callPublicApi(
        publicContractsV1.agent.get,
        {
          cursor: options.cursor,
          sessionId: options.sessionId,
          waitSeconds: plan.waitSeconds,
        },
        plan.requestOptions,
      ),
    );
    if (held.type !== "answered") return held;
    if (held.value.wokeOn !== "timeout") return { type: "activity" };
  }
}
