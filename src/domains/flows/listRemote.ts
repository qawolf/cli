import picomatch from "picomatch";

import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";

import { renderListTable } from "./renderListTable.js";

type RemoteListItem = {
  id: string;
  file: string;
  name: string;
  tags: readonly string[];
  target: string;
};

export async function flowsListRemote(
  ctx: AuthCommandContext,
  pattern: string | undefined,
): Promise<CommandResult> {
  const result = await ctx.platform.getRemoteFlows();
  if (!result.ok) {
    return { error: result.error };
  }

  const matches = pattern ? picomatch(pattern) : undefined;
  const items: RemoteListItem[] = result.value.flows
    .filter((f) => !matches || matches(f.path))
    .map((f) => ({
      id: f.id,
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
