import { dirname } from "node:path";

import type { Fs } from "~/shell/fs.js";
import {
  createCompositeReporter,
  createConsoleReporter,
  createJUnitReporter,
  resolveJUnitOutputPath,
  type Reporter,
} from "~/shell/reporter/index.js";

type WriteSink = { write: (str: string) => void };

export type BuildRunReporterDeps = {
  fs: Fs;
  stdout?: WriteSink;
  stderr?: WriteSink;
  projectDir?: string;
};

/**
 * Assemble the run reporter from flags. The console reporter always runs; when
 * `--junit` is set, a JUnit file reporter is composited alongside it. The XML
 * file is a disk artifact, independent of stdout output mode (--json/--agent).
 */
export function buildRunReporter(
  flags: { junit?: string | boolean; outputDir: string },
  deps: BuildRunReporterDeps,
): Reporter {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const console = createConsoleReporter({
    stdout,
    stderr,
    ...(deps.projectDir !== undefined ? { projectDir: deps.projectDir } : {}),
  });
  // `undefined` means the flag was absent; an empty string (`--junit=`) still
  // enables it and resolves to the default path.
  if (flags.junit === undefined) return console;

  const junit = createJUnitReporter({
    outputPath: resolveJUnitOutputPath(flags.junit, flags.outputDir),
    writeFile: (path, content) => {
      deps.fs.mkdirSync(dirname(path), { recursive: true });
      deps.fs.writeFileSync(path, content);
    },
    stderr,
  });
  return createCompositeReporter([console, junit]);
}
