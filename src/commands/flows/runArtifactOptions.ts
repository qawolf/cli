import type { Command } from "commander";

import type {
  HarContent,
  HarMode,
  TraceMode,
  VideoMode,
} from "~/core/types.js";
import { defaultOutputDir } from "~/core/paths.js";
import { parseEnum } from "~/domains/runner/runFlagParsers.js";

const videoModes = ["on", "off", "retain-on-failure"] as const;
const traceModes = ["on", "off", "retain-on-failure"] as const;
const harModes = ["on", "off", "retain-on-failure"] as const;
const harContentModes = ["full", "omit"] as const;
const videoDefault: VideoMode = "off";
const traceDefault: TraceMode = "off";
const harDefault: HarMode = "off";
const harContentDefault: HarContent = "omit";

/**
 * Adds the flags controlling what a run records and where it writes it.
 *
 * Grouped apart from the rest of `flows run` because they share one concern —
 * run artifacts — and are registered as a unit.
 */
export function addRunArtifactOptions(command: Command): Command {
  return command
    .option(
      "--video <mode>",
      "Record video: on | off | retain-on-failure",
      parseEnum<VideoMode>("--video", videoModes),
      videoDefault,
    )
    .option(
      "--trace <mode>",
      "Record Playwright trace: on | off | retain-on-failure",
      parseEnum<TraceMode>("--trace", traceModes),
      traceDefault,
    )
    .option(
      "--har <mode>",
      "Record HAR network log: on | off | retain-on-failure",
      parseEnum<HarMode>("--har", harModes),
      harDefault,
    )
    .option(
      "--har-content <mode>",
      "HAR response bodies: omit | full (full uses more memory)",
      parseEnum<HarContent>("--har-content", harContentModes),
      harContentDefault,
    )
    .option(
      "--output-dir <path>",
      "Directory for run artifacts (videos, traces, HAR)",
      defaultOutputDir,
    )
    .option(
      "--junit [path]",
      "Write a JUnit XML report (default: <output-dir>/junit-report.xml)",
    );
}
