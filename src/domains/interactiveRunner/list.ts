import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { type TableColumn, renderTable } from "~/core/renderTable.js";
import type {
  AuthCommandContext,
  CommandResult,
  RunnerApiContext,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import {
  failureFields,
  type PlatformFailure,
} from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { runnerIdEnvironmentVariable } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

type RunnerListItem = {
  id: string;
  isDefault: boolean;
  runnerName: string;
};

export type ListedRunners =
  | { items: RunnerListItem[]; ok: true }
  | ({ ok: false } & PlatformFailure);

const columns: readonly TableColumn<RunnerListItem>[] = [
  { header: "id", value: (row) => row.id },
  { header: "family", value: (row) => row.runnerName },
  { header: "default", value: (row) => (row.isDefault ? "yes" : "") },
];

async function readDefaultRunnerId(
  deps: InteractiveRunnerDeps,
): Promise<string | undefined> {
  const environmentValue = deps.env[runnerIdEnvironmentVariable]?.trim();
  if (environmentValue) return environmentValue;
  return deps.store.readDefaultRunnerId();
}

/**
 * The team's running runners, as the platform sees them: a runner launched from
 * another checkout, another machine, or an earlier session is listed alongside
 * this directory's own. The directory's records are only consulted to forget
 * the runners the platform no longer has.
 */
export async function listRunners(
  ctx: RunnerApiContext,
  deps: InteractiveRunnerDeps,
): Promise<ListedRunners> {
  const listed = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.list,
    {},
    runnerCallOptions,
  );
  if (!listed.ok) return { ...failureFields(listed), ok: false };

  const defaultRunnerId = await readDefaultRunnerId(deps);
  const runningIds = new Set(listed.value.runners.map((runner) => runner.id));
  const held = await deps.store.readRunners();
  const gone = held
    .filter((runner) => !runningIds.has(runner.id))
    .map((runner) => runner.id);
  await deps.store.dropRunners(gone).catch(() => undefined);

  const byId = [...listed.value.runners].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  return {
    items: [
      ...byId.filter((runner) => runner.id === defaultRunnerId),
      ...byId.filter((runner) => runner.id !== defaultRunnerId),
    ].map((runner) => ({
      id: runner.id,
      isDefault: runner.id === defaultRunnerId,
      runnerName: runner.runnerName,
    })),
    ok: true,
  };
}

export async function handleRunnerList(
  ctx: AuthCommandContext,
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const listed = await listRunners(ctx, deps);
  if (!listed.ok) {
    return { ...failureFields(listed), exitCode: exitCodes.network };
  }
  const items = listed.items;

  if (ctx.ui.mode === "json") {
    ctx.ui.json(items);
    return;
  }
  if (items.length === 0) {
    ctx.ui.info(interactiveRunnerMessages.noRunners);
    return;
  }
  if (ctx.ui.mode === "agent") {
    ctx.ui.write(renderTable({ boldHeader: false, columns, rows: items }));
    return;
  }
  ctx.ui.gap();
  ctx.ui.intro(interactiveRunnerMessages.title);
  ctx.ui.write(renderTable({ boldHeader: true, columns, rows: items }));
  ctx.ui.outro(interactiveRunnerMessages.runnerCount(items.length));
}
