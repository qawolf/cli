import { resolveChannels } from "./harness/channels.js";
import { report } from "./harness/report.js";
import { runCase } from "./harness/runCase.js";
import { createRuntimeRoot } from "./harness/tmpWorkspace.js";
import type { CaseResult, ChannelName, Suite } from "./harness/types.js";
import { allSuites, getSuite } from "./suites/index.js";

type CliArgs = {
  readonly suiteName: string | undefined;
  readonly channel: "node" | "binary" | "both";
  readonly noCleanup: boolean;
  readonly json: boolean;
};

function parseArgs(argv: readonly string[]): CliArgs {
  let suiteName: string | undefined;
  let channel: CliArgs["channel"] = "both";
  let noCleanup = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--channel") {
      const value = argv[++i];
      if (value !== "node" && value !== "binary" && value !== "both") {
        throw new Error(
          `--channel must be node|binary|both, got: ${value ?? "(missing)"}`,
        );
      }
      channel = value;
    } else if (arg === "--no-cleanup") noCleanup = true;
    else if (arg === "--json") json = true;
    else if (arg !== undefined && !arg.startsWith("--")) suiteName = arg;
  }
  return { suiteName, channel, noCleanup, json };
}

function resolveSuites(suiteName: string | undefined): Suite[] {
  if (suiteName === undefined) return allSuites();
  const suite = getSuite(suiteName);
  if (!suite) {
    const known = allSuites()
      .map((registered) => registered.name)
      .join(", ");
    throw new Error(`Unknown suite: ${suiteName}. Known suites: ${known}`);
  }
  return [suite];
}

function selectChannelNames(
  suite: Suite,
  channel: CliArgs["channel"],
): ChannelName[] {
  if (channel === "both") return [...suite.channels];
  return suite.channels.includes(channel) ? [channel] : [];
}

async function runSuite(suite: Suite, args: CliArgs): Promise<CaseResult[]> {
  // Skip the build for an empty suite — keeps the placeholder fast and build-free.
  if (suite.cases.length === 0) return [];
  const channels = await resolveChannels(
    selectChannelNames(suite, args.channel),
  );
  // One shared managed-runtime root warms once per channel (see createRuntimeRoot).
  const runtime = createRuntimeRoot();
  const results: CaseResult[] = [];
  try {
    for (const channel of channels) {
      for (const shape of suite.cases) {
        results.push(
          await runCase(channel, shape, runtime.runtimeDir, {
            noCleanup: args.noCleanup,
          }),
        );
      }
    }
  } finally {
    if (!args.noCleanup) runtime.cleanup();
  }
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const results: CaseResult[] = [];
  for (const suite of resolveSuites(args.suiteName)) {
    results.push(...(await runSuite(suite, args)));
  }
  process.exit(report(results, { json: args.json }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
