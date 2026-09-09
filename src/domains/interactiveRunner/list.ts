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
  /** Whether this directory launched the runner, as opposed to another checkout, machine or session. */
  launchedHere: boolean;
  runnerName: string;
  /** The QA Wolf page showing this runner's live screen. */
  url: string;
};

export type ListedRunners =
  | { items: RunnerListItem[]; ok: true }
  | ({ ok: false } & PlatformFailure);

// No url column: an address beside a 63-character id outgrows a terminal, so
// --json carries it instead.
const columns: readonly TableColumn<RunnerListItem>[] = [
  { header: "id", value: (row) => row.id },
  { header: "family", value: (row) => row.runnerName },
  { header: "launched here", value: (row) => (row.launchedHere ? "yes" : "") },
  { header: "default", value: (row) => (row.isDefault ? "yes" : "") },
];

function rank(item: RunnerListItem): number {
  if (item.isDefault) return 0;
  return item.launchedHere ? 1 : 2;
}

async function readDefaultRunnerId(
  deps: InteractiveRunnerDeps,
): Promise<string | undefined> {
  const environmentValue = deps.env[runnerIdEnvironmentVariable]?.trim();
  if (environmentValue) return environmentValue;
  return deps.store.readDefaultRunnerId();
}

/**
 * The team's active runners: a runner launched from another checkout, another
 * machine, or an earlier session is listed alongside this directory's own.
 * The directory's records supply the default runner when QAWOLF_RUNNER_ID is
 * unset, say which runners were launched here, and are pruned of the runners
 * that are no longer active.
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

  const heldIds = new Set(held.map((runner) => runner.id));
  const items = listed.value.runners.map((runner) => ({
    id: runner.id,
    isDefault: runner.id === defaultRunnerId,
    launchedHere: heldIds.has(runner.id),
    runnerName: runner.runnerName,
    url: runner.url,
  }));
  return {
    items: items.sort(
      (left, right) =>
        rank(left) - rank(right) || left.id.localeCompare(right.id),
    ),
    ok: true,
  };
}

export async function handleRunnerList(
  ctx: AuthCommandContext,
  options: { here: boolean },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const listed = await listRunners(ctx, deps);
  if (!listed.ok) {
    return { ...failureFields(listed), exitCode: exitCodes.network };
  }
  const items = options.here
    ? listed.items.filter((item) => item.launchedHere)
    : listed.items;

  if (ctx.ui.mode === "json") {
    ctx.ui.json(items);
    return;
  }
  if (items.length === 0) {
    ctx.ui.info(
      options.here
        ? interactiveRunnerMessages.noRunnersHere
        : interactiveRunnerMessages.noRunners,
    );
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
