import type { TestCounts } from "~/types.js";
import type { FlowRunError } from "./errors.js";

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
  callback: (deps: FlowDeps) => Promise<void>;
};

export type SignalRegistry = {
  on: (signal: NodeJS.Signals, handler: () => void) => () => void;
};

export type AsyncStorage<T> = {
  run: (store: T, callback: () => Promise<void>) => Promise<void>;
  getStore: () => T | undefined;
};

export type RunnerFs = {
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  writeFile: (path: string, data: string) => Promise<void>;
};

export type SpawnResult = {
  exitCode: Promise<number>;
  kill: () => void;
};

export type SpawnFn = (command: string, args: string[]) => SpawnResult;

export type RunnerDeps = {
  fs: RunnerFs;
  spawn: SpawnFn;
  signals: SignalRegistry;
  createStorage: <T>() => AsyncStorage<T>;
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
};

export type Runner = {
  run: (flowDef: FlowDefinition) => Promise<FlowRunResult>;
};
