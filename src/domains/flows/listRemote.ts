import picomatch from "picomatch";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";
import { matchesSelectors } from "~/core/flowSelectors.js";

import { fetchKnownTags } from "./fetchKnownTags.js";
import { renderFlowsList } from "./renderFlowsList.js";
import { filterFlows } from "./filterFlows.js";
import { renderListTable, type FlowsListRow } from "./renderListTable.js";
import { type ListView, printedView, unavailableView } from "./listView.js";
import { emptySelectionResult } from "./selectorGuards.js";

type RemoteListItem = {
  flowId: string;
  file: string;
  name: string;
  tags: readonly string[];
  target: string;
  url: string;
};

const toListRow = (it: RemoteListItem): FlowsListRow => ({
  name: it.name,
  flowId: it.flowId,
  target: it.target,
  // A remote listing is scoped to one environment by definition, so the env
  // column would repeat the --env value on every row.
  env: undefined,
  tags: it.tags,
  file: it.file,
});

export type FlowsListRemoteOptions = {
  readonly env: string;
  readonly includeDrafts: boolean;
  readonly aiTaskId: string | undefined;
  readonly tags: readonly string[];
};

export async function flowsListRemote(
  ctx: AuthCommandContext,
  pattern: string | undefined,
  options: FlowsListRemoteOptions,
  view: ListView = printedView,
): Promise<CommandResult> {
  const unavailable = unavailableView(ctx, view);
  if (unavailable !== undefined) return unavailable;

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.flow.list,
    {
      aiTaskId: options.aiTaskId,
      environmentId: options.env,
      includeDrafts: options.includeDrafts,
    },
  );
  if (!result.ok) return failureFields(result);

  const matches = pattern ? picomatch(pattern) : undefined;
  const all: RemoteListItem[] = result.value.flows
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
      url: f.url,
    }));

  const selectors = { tags: options.tags };
  const items = all.filter((item) => matchesSelectors(item, selectors));

  // Tags are team-scoped, so only the team list can tell a typo from a real
  // tag that nothing here carries.
  const empty = await emptySelectionResult(selectors, items.length, () =>
    fetchKnownTags(ctx),
  );
  if (empty !== undefined) return empty;

  if (view.interactive) {
    return filterFlows(ctx.ui, items.map(toListRow), view, {
      title: flowsMessages.remoteTitle,
    });
  }
  if (ctx.ui.mode === "json") {
    ctx.ui.json(items);
    return;
  }
  if (items.length === 0) {
    ctx.ui.info(runnerMessages.noFlowsMatched);
    return;
  }
  const rows = items.map(toListRow);
  if (ctx.ui.mode === "agent") {
    ctx.ui.write(renderListTable(rows, false));
    return;
  }
  ctx.ui.gap();
  ctx.ui.intro(flowsMessages.remoteTitle);
  ctx.ui.write(renderFlowsList(rows, { styled: true, columns: view.columns }));
  ctx.ui.outro(flowsMessages.flowCount(items.length));
}
