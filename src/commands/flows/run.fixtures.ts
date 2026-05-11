import { mock } from "bun:test";

import type { CommandContext } from "~/lib/context.js";
import type { UI } from "~/lib/ui/index.js";

import type { FlowsRunDeps, FlowsRunFlags } from "./runInternals.js";

export const FAKE_CWD = "/proj";

// Note: this duplicates `makeFakeUI` from `src/commands/install/browsers.fixtures.ts`.
// Lift to a shared `~/lib/test/ui.ts` (or similar) when a third file needs it.
export function makeFakeUI(): UI {
  return {
    mode: "human",
    gap: mock(() => {}),
    intro: mock(() => {}),
    note: mock(() => {}),
    outro: mock(() => {}),
    confirm: mock(() => Promise.resolve({ ok: false } as const)),
    password: mock(() => Promise.resolve({ ok: false } as const)),
    withProgress: mock(() =>
      Promise.resolve([]),
    ) as unknown as UI["withProgress"],
    step: mock(() => {}),
    success: mock(() => {}),
    warn: mock(() => {}),
    cancel: mock(() => {}),
    json: mock(() => {}),
    output: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
  };
}

export const makeCtx = (ui: UI = makeFakeUI()): CommandContext => ({
  ui,
  configDir: "/tmp/test-config",
  outputMode: "human",
  isInteractive: false,
  apiBaseUrl: "https://example.invalid",
});

export function defaultFlags(): FlowsRunFlags {
  return {
    retries: 0,
    bail: false,
    workers: 1,
    timeout: 30_000,
    video: "off",
    trace: "off",
    outputDir: "qawolf-output",
  };
}

type DepsOverrides = {
  files?: readonly string[];
  metaByFile?: Record<string, { name?: string; target?: string }>;
  installError?: Error;
};

export function makeDeps(overrides: DepsOverrides = {}): FlowsRunDeps {
  const files = overrides.files ?? [];
  const metaByFile = overrides.metaByFile ?? {};
  return {
    cwd: FAKE_CWD,
    expandPatterns: mock<FlowsRunDeps["expandPatterns"]>(() =>
      Promise.resolve([...files]),
    ),
    peekFlowMeta: mock<FlowsRunDeps["peekFlowMeta"]>((file: string) =>
      Promise.resolve({
        name: metaByFile[file]?.name,
        target: metaByFile[file]?.target,
      }),
    ),
    installBrowsers: mock<FlowsRunDeps["installBrowsers"]>(() =>
      overrides.installError
        ? Promise.reject(overrides.installError)
        : Promise.resolve(),
    ),
  };
}
