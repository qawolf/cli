import { mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { UI } from "~/shell/ui/index.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type {
  FilterListArgs,
  FilterListFn,
  PromptResult,
} from "~/shell/ui/renderers/types.js";

const noopSignals = makeNoopSignals();

export function makeFakeUI(mode: OutputMode = "human"): UI {
  return {
    mode,
    gap: mock(() => {}),
    intro: mock(() => {}),
    note: mock(() => {}),
    outro: mock(() => {}),
    confirm: mock(() => Promise.resolve({ ok: false } as const)),
    password: mock(() => Promise.resolve({ ok: false } as const)),
    select: mock(() => Promise.resolve({ ok: false } as const)),
    filterList: mock(() => Promise.resolve({ ok: false } as const)),
    withProgress: mock(
      async (steps: { message: string; task: () => Promise<unknown> }[]) => {
        const results: unknown[] = [];
        for (const step of steps) {
          results.push(await step.task());
        }
        return results;
      },
    ) as unknown as UI["withProgress"],
    step: mock(() => {}),
    stream: mock(() => {}),
    success: mock(() => {}),
    warn: mock(() => {}),
    cancel: mock(() => {}),
    json: mock(() => {}),
    output: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    write: mock(() => {}),
  };
}

export function makeCtx(
  mode: OutputMode = "human",
  overrides: Partial<Omit<CommandContext, "ui">> = {},
): CommandContext {
  return {
    ui: makeFakeUI(mode),
    configDir: "/tmp/test-config",
    outputMode: mode,
    isInteractive: false,
    apiBaseUrl: "https://example.invalid",
    signals: noopSignals,
    log: () => makeNoopLogger(),
    fs: makeMemoryFs(),
    ...overrides,
  };
}

/**
 * The recorded calls of a bun mock. Lives in the shell layer because tests in
 * any layer inspect UI mocks, and a domain must not import a sibling domain
 * to get at it.
 */
export const callsOf = <T extends (...args: never) => unknown>(
  fn: T,
): unknown[][] => (fn as unknown as ReturnType<typeof mock>).mock.calls;

/**
 * A `filterList` that answers with `answer`, recording what each call offered.
 * `FilterListFn` is generic over the item type, so the one cast it needs lives
 * here rather than in every test.
 */
export function fakeFilterList<Item>(
  answer: (args: FilterListArgs<Item>) => PromptResult<readonly Item[]>,
): { filterList: FilterListFn; calls: FilterListArgs<Item>[] } {
  const calls: FilterListArgs<Item>[] = [];
  const filterList = (args: FilterListArgs<Item>) => {
    calls.push(args);
    return Promise.resolve(answer(args));
  };
  return { filterList: filterList as unknown as FilterListFn, calls };
}
