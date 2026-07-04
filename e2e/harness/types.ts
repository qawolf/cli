/** The two ways the CLI ships: Node + dist/cli.js, or a compiled standalone binary. */
export type ChannelName = "node" | "binary";

/**
 * A built CLI artifact driven by reference (no global install). Spawn
 * `command` with `[...prefixArgs, ...cliArgs]`. The node channel runs the real
 * `node` binary against `dist/cli.js`; the binary channel runs `dist/qawolf`
 * directly with no prefix.
 */
export type Channel = {
  readonly label: ChannelName;
  readonly command: string;
  readonly prefixArgs: readonly string[];
};

/** Which flow template a shape drops into its project tree. */
export type FlowTemplate = "simpleNav" | "nativeAndVersioned";

/** A single file written into a shape's tmp project (package.json, lockfiles, etc.). */
export type ShapeFile = { readonly path: string; readonly content: string };

/**
 * A generated project shape exercising one repo layout. `files` excludes the
 * flow itself; the flow template named by `flow` is written at
 * `join(runDir, flowArg)`. `runDir` is the subdir to run `flows run` from ("" =
 * project root); `flowArg` is the flow path relative to that run dir.
 */
export type RepoShape = {
  readonly name: string;
  readonly proves: string;
  readonly files: readonly ShapeFile[];
  readonly flow: FlowTemplate;
  readonly runDir: string;
  readonly flowArg: string;
};

/** A named, data-driven set of cases run across one or more channels. */
export type Suite = {
  readonly name: string;
  readonly cases: readonly RepoShape[];
  readonly channels: readonly ChannelName[];
};

/** Outcome of running one shape on one channel. */
export type CaseResult = {
  readonly caseName: string;
  readonly channel: ChannelName;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly exitCode: number;
  // Parsed from the JUnit `failures="N"` attribute; undefined when no JUnit was produced.
  readonly failures: number | undefined;
  // Offending node_modules paths found in the project; empty means clean.
  readonly pollution: readonly string[];
  // Human-readable reasons the case failed; empty means it passed.
  readonly assertionFailures: readonly string[];
  readonly output: string;
};
