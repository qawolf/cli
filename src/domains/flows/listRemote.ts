import picomatch from "picomatch";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";

import { renderListTable } from "./renderListTable.js";

type RemoteListItem = {
  flowId: string;
  file: string;
  name: string;
  tags: readonly string[];
  target: string;
};

export type FlowsListRemoteOptions = {
  readonly env: string;
  readonly includeDrafts: boolean;
};

export async function flowsListRemote(
  ctx: AuthCommandContext,
  pattern: string | undefined,
  options: FlowsListRemoteOptions,
): Promise<CommandResult> {
  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.flow.list,
    {
      environmentId: options.env,
      includeDrafts: options.includeDrafts,
    },
  );
  if (!result.ok) return failureFields(result);

  const matches = pattern ? picomatch(pattern) : undefined;
  const items: RemoteListItem[] = result.value.flows
    .filter((f) => !matches || matches(f.path))
    .map((f) => ({
      flowId: f.flowId,
      file: f.path,
      name: f.name,
      tags: f.tags,
      target:
        typeof f.executionTarget === "string"
          ? f.executionTarget
          : JSON.stringify(f.executionTarget),
    }));

  if (ctx.ui.mode === "json") {
    ctx.ui.json(items);
    return;
  }
  if (items.length === 0) {
    ctx.ui.info(runnerMessages.noFlowsMatched);
    return;
  }
  const rows = items.map((it) => ({
    name: it.name,
    target: it.target,
    file: it.file,
  }));
  if (ctx.ui.mode === "agent") {
    ctx.ui.write(renderListTable(rows, false));
    return;
  }
  ctx.ui.gap();
  ctx.ui.intro(flowsMessages.remoteTitle);
  ctx.ui.write(renderListTable(rows, true));
  ctx.ui.outro(flowsMessages.flowCount(items.length));
}
