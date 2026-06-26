import type { Fs } from "~/shell/fs.js";
import type { FlowStamp } from "~/shell/manifest/types.js";
import type { Logger } from "~/shell/logger.js";
import type { TestCounts } from "~/core/types.js";
import type { FlowRunError } from "./errors.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

export type { SignalRegistry };

export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };

export type FlowInput = Record<string, Record<string, unknown>>;

export type FlowDeps = {
  flowInputs: FlowInput;
  setOutput: (key: string, value: JsonSerializable) => void;
  test: (name: string, fn: () => Promise<void>) => Promise<void>;
};

export type FlowDefinition = {
  name: string;
  path: string;
  callback: (deps: FlowDeps) => Promise<void>;
};

export type AsyncStorage<T> = {
  run: (store: T, callback: () => Promise<void>) => Promise<void>;
  getStore: () => T | undefined;
};

export type RunnerFs = Pick<Fs, "mkdir" | "writeFile" | "unlink">;

export type RunnerSpawnResult = {
  exitCode: Promise<number>;
  kill: () => void;
};

export type RunnerSpawnFn = (
  command: string,
  args: string[],
) => RunnerSpawnResult;

export type RunnerDeps = {
  fs: RunnerFs;
  spawn: RunnerSpawnFn;
  signals: SignalRegistry;
  createStorage: <T>() => AsyncStorage<T>;
  // Directory the flow runtime resolves @qawolf/flows + playwright from.
  depsRoot: string;
  logger?: Logger;
};

export type RunnerOptions = {
  retries: number;
  outputDir: string;
  flowInputs?: FlowInput;
};

export type FlowRunResult = {
  passed: boolean;
  testCounts: TestCounts;
  attempts: number;
  error?: FlowRunError;
  // Populated when the flow file lives under .qawolf/<env>/ and is listed
  // in that env's manifest. Identifies the run for diagnostics.
  manifest?: FlowStamp;
};

export type Runner = {
  run: (flowDef: FlowDefinition) => Promise<FlowRunResult>;
};
