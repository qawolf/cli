import { sep } from "node:path";
import { Writable } from "node:stream";
import type { RunFiles } from "@qawolf/api-contracts/v1";

import type { Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import {
  type ScreenshotStdout,
  writeScreenshot,
} from "~/shell/interactiveRunner/writeScreenshot.js";
import { makeRunFilesManifestStore } from "~/shell/interactiveRunner/runFilesManifest.js";
import { makeRunnerStore } from "~/shell/interactiveRunner/runnerStore.js";

import type { InteractiveRunnerDeps } from "./deps.js";

export const testCwd = "/workspace";

export { makeAuthCtx } from "~/shell/commandContext.testUtils.js";

/** What reached the filesystem, so a test can assert on the bytes themselves. */
export type WrittenScreenshot = { bytes: Uint8Array; path: string };

export function makeTestDeps(
  overrides: Partial<InteractiveRunnerDeps> = {},
): InteractiveRunnerDeps & {
  /** Every chunk handed to stdout, in order. */
  stdoutWrites: Uint8Array[];
  written: WrittenScreenshot[];
} {
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
  const stdoutWrites: Uint8Array[] = [];
  const recordingStdout: ScreenshotStdout = new Writable({
    write(chunk: Uint8Array, _encoding, callback) {
      stdoutWrites.push(Uint8Array.from(chunk));
      callback();
    },
  });
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
    runFilesManifest: makeRunFilesManifestStore({
      cwd: testCwd,
      fs: makeMemoryFs(),
    }),
    sleep: async () => {},
    store: makeRunnerStore({ cwd: testCwd, fs: makeMemoryFs() }),
    stdoutWrites,
    writeScreenshot: (screenshot) =>
      writeScreenshot({
        ...screenshot,
        fs: recordingFs,
        stdout: recordingStdout,
      }),
    written,
    ...overrides,
  };
}
