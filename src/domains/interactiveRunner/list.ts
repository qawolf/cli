import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { batchMap } from "~/core/batchMap.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { type TableColumn, renderTable } from "~/core/renderTable.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import {
  failureFields,
  type PlatformFailure,
} from "~/shell/platform/requestWithRetry.js";
import type { StoredRunner } from "~/shell/interactiveRunner/runnerStore.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { runnerIdEnvironmentVariable } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

type RunnerListItem = {
  id: string;
  isDefault: boolean;
  runnerName: string | undefined;
};

const columns: readonly TableColumn<RunnerListItem>[] = [
  { header: "id", value: (row) => row.id },
  { header: "family", value: (row) => row.runnerName ?? "" },
  { header: "default", value: (row) => (row.isDefault ? "yes" : "") },
];

const probeBatchSize = 8;

type Probe =
  | { ok: true; runner: StoredRunner; running: boolean }
  | ({ ok: false } & PlatformFailure);

async function readCandidates(deps: InteractiveRunnerDeps): Promise<{
  candidates: StoredRunner[];
  defaultRunnerId: string | undefined;
}> {
  const held = await deps.store.readRunners();
  const storedDefault = await deps.store.readDefaultRunnerId();
  const environmentValue = deps.env[runnerIdEnvironmentVariable]?.trim();
  const fromEnvironment = environmentValue ? environmentValue : undefined;

  const candidates = [...held];
  for (const id of [storedDefault, fromEnvironment]) {
    if (id !== undefined && !candidates.some((runner) => runner.id === id)) {
      candidates.push({ id });
    }
  }
  return { candidates, defaultRunnerId: fromEnvironment ?? storedDefault };
}

async function probeRunner(
  ctx: AuthCommandContext,
  runner: StoredRunner,
): Promise<Probe> {
  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.get,
    { id: runner.id },
    runnerCallOptions,
  );
  if (!result.ok) return { ...failureFields(result), ok: false };
  return { ok: true, runner, running: result.value.running };
}

export async function handleRunnerList(
  ctx: AuthCommandContext,
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const { candidates, defaultRunnerId } = await readCandidates(deps);

  const running: StoredRunner[] = [];
  for await (const probe of batchMap(
    candidates,
    (runner) => probeRunner(ctx, runner),
    probeBatchSize,
  )) {
    if (!probe.ok) {
      return { ...failureFields(probe), exitCode: exitCodes.network };
    }
    if (probe.running) running.push(probe.runner);
  }

  await deps.store
    .retainRunners(running.map((runner) => runner.id))
    .catch(() => undefined);

  const items: RunnerListItem[] = [
    ...running.filter((runner) => runner.id === defaultRunnerId),
    ...running.filter((runner) => runner.id !== defaultRunnerId),
  ].map((runner) => ({
    id: runner.id,
    isDefault: runner.id === defaultRunnerId,
    runnerName: runner.runnerName,
  }));

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
