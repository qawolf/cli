import { sep } from "node:path";
import type { Mock } from "bun:test";
import type { RunFiles } from "@qawolf/api-contracts/v1";

import { makeCtx } from "~/shell/commandContext.testUtils.js";
import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { writeScreenshot } from "~/shell/interactiveRunner/writeScreenshot.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { makeRunnerStore } from "~/shell/interactiveRunner/runnerStore.js";
import type {
  AuthCommandContext,
  CommandContext,
} from "~/shell/commandContext.js";
import type { OutputMode } from "~/shell/ui/env.js";

import type { InteractiveRunnerDeps } from "./deps.js";

export const testCwd = "/workspace";

export function makeAuthCtx(mode: OutputMode = "human"): {
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>;
  ctx: AuthCommandContext;
  outputs: () => { data: unknown; humanMessage: string }[];
  streamed: () => string[];
  streamedData: () => unknown[];
  warnings: () => string[];
} {
  const callPublicApi = makeCallPublicApiMock();
  const base: CommandContext = makeCtx(mode);
  return {
    callPublicApi,
    ctx: {
      ...base,
      apiKeySource: "env",
      platformClient: makeMockPlatformClient({ callPublicApi }),
    },
    outputs: () =>
      (
        base.ui.output as Mock<(data: unknown, humanMessage: string) => void>
      ).mock.calls.map(([data, humanMessage]) => ({ data, humanMessage })),
    streamed: () => streamCalls(base).map(([, line]) => line),
    streamedData: () => streamCalls(base).map(([data]) => data),
    warnings: () =>
      (base.ui.warn as Mock<(message: string) => void>).mock.calls.map(
        ([message]) => message,
      ),
  };
}

function streamCalls(base: CommandContext): [unknown, string][] {
  return (base.ui.stream as Mock<(data: unknown, line: string) => void>).mock
    .calls;
}

/** What reached the filesystem, so a test can assert on the bytes themselves. */
export type WrittenScreenshot = { bytes: Uint8Array; path: string };

export function makeTestDeps(
  overrides: Partial<InteractiveRunnerDeps> = {},
): InteractiveRunnerDeps & { written: WrittenScreenshot[] } {
  const files: RunFiles = {
    "flow.ts": "export default {};",
    "package.json": "{}",
  };
  const written: WrittenScreenshot[] = [];
  // The real writer over a memory filesystem, rather than a stand-in that
  // decodes for itself: a double with its own `Buffer.from` would keep passing
  // if the real one were changed to write the base64 string, which is the whole
  // thing it exists to prevent.
  const fs = makeMemoryFs();
  const recordingFs: Fs = {
    ...fs,
    async writeFile(path, data, options) {
      await fs.writeFile(path, data, options);
      written.push({ bytes: Uint8Array.from(data as Uint8Array), path });
    },
  };
  return {
    collectRunFiles: async () => ({ files, unresolvedImports: [] }),
    cwd: testCwd,
    env: {},
    makeRunnerId: () => "cli-minted",
    readFile: async (path) => {
      // Handlers that build an absolute path from `cwd` and ones that pass a
      // collected path through both land here, on either platform's separator.
      const collected = path.split(sep).join("/").replace(`${testCwd}/`, "");
      const content = files[collected];
      if (content === undefined) throw Error(`no such file: ${path}`);
      return content;
    },
    readStdin: async () => "",
    sleep: async () => {},
    store: makeRunnerStore({ cwd: testCwd, fs: makeMemoryFs() }),
    writeScreenshot: (screenshot) =>
      writeScreenshot({ ...screenshot, fs: recordingFs }),
    written,
    ...overrides,
  };
}
