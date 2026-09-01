import picomatch from "picomatch";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";
import { hasSelectors, matchesSelectors } from "~/core/flowSelectors.js";
import { exitCodes } from "~/shell/exit.js";

import { explainEmptySelection } from "./explainEmptySelection.js";
import { fetchKnownTags } from "./fetchKnownTags.js";
import { renderListTable } from "./renderListTable.js";

type RemoteListItem = {
  flowId: string;
  file: string;
  name: string;
  tags: readonly string[];
  target: string;
  url: string;
};

export type FlowsListRemoteOptions = {
  readonly env: string;
  readonly includeDrafts: boolean;
  readonly tags: readonly string[];
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

  // An explicit selector that matches nothing is a mistake worth reporting,
  // not an empty listing: exiting 0 here reads as "there are none".
  if (items.length === 0 && hasSelectors(selectors)) {
    // Tags are team-scoped, so only the team list can tell a typo from a real
    // tag that nothing here carries. Fetched only now that something already
    // failed to match, so the happy path stays one call.
    return {
      error: explainEmptySelection(selectors, await fetchKnownTags(ctx)),
      exitCode: exitCodes.invalidArgs,
    };
  }

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
    tags: it.tags,
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
