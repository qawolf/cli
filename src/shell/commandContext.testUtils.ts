import { type Mock, mock } from "bun:test";

import type {
  AuthCommandContext,
  CommandContext,
} from "~/shell/commandContext.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { OutputMode } from "~/shell/ui/env.js";
import type { UI } from "~/shell/ui/index.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

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
    text: mock(() => Promise.resolve({ ok: false } as const)),
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
    transcript: mock(() => {}),
    wait: mock(() => ({ stop: mock(() => {}) })),
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

/** Every message a one-argument UI method was called with, in order. */
const messagesOf = (fn: unknown): string[] =>
  (fn as Mock<(message: string) => void>).mock.calls.map(
    ([message]) => message,
  );

/**
 * An authenticated context over a fake UI and a mocked platform client, with
 * accessors for what each UI method was told. Shared by every domain that
 * tests a handler against the public API.
 */
export function makeAuthCtx(
  mode: OutputMode = "human",
  overrides: { isInteractive?: boolean } = {},
): {
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>;
  ctx: AuthCommandContext;
  infos: () => string[];
  jsonLines: () => unknown[];
  outputs: () => { data: unknown; humanMessage: string }[];
  streamed: () => string[];
  streamedData: () => unknown[];
  successes: () => string[];
  transcripts: () => { body: string; data: unknown; headline: string }[];
  warnings: () => string[];
} {
  const callPublicApi = makeCallPublicApiMock();
  const base: CommandContext = makeCtx(mode, {
    isInteractive: overrides.isInteractive ?? false,
  });
  const streamCalls = () =>
    (base.ui.stream as Mock<(data: unknown, line: string) => void>).mock.calls;
  return {
    callPublicApi,
    ctx: {
      ...base,
      apiKeySource: "env",
      platformClient: makeMockPlatformClient({ callPublicApi }),
    },
    infos: () => messagesOf(base.ui.info),
    jsonLines: () =>
      (base.ui.json as Mock<(data: unknown) => void>).mock.calls.map(
        ([data]) => data,
      ),
    outputs: () =>
      (
        base.ui.output as Mock<(data: unknown, humanMessage: string) => void>
      ).mock.calls.map(([data, humanMessage]) => ({ data, humanMessage })),
    streamed: () => streamCalls().map(([, line]) => line),
    streamedData: () => streamCalls().map(([data]) => data),
    successes: () => messagesOf(base.ui.success),
    transcripts: () =>
      (
        base.ui.transcript as Mock<
          (entry: { body: string; data: unknown; headline: string }) => void
        >
      ).mock.calls.map(([entry]) => entry),
    warnings: () => messagesOf(base.ui.warn),
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
