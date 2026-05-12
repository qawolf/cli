import type {
  BrowserName,
  HarMode,
  TestCounts,
  TraceMode,
  VideoMode,
} from "~/types.js";

export type RunMeta = {
  browsers: BrowserName[];
  workers: number;
  headed: boolean;
  video: VideoMode;
  trace: TraceMode;
  har: HarMode;
};

export type RunSummary = {
  flowsPassed: number;
  flowsFailed: number;
  flowsSkipped: number;
  testsPassed: number;
  testsTotal: number;
  durationMs: number;
  meta: RunMeta;
};

export type Reporter = {
  onFlowStart?: (event: { name: string; path: string }) => void;
  onFlowPass?: (event: {
    name: string;
    path: string;
    tests: TestCounts;
    durationMs: number;
  }) => void;
  onFlowFail?: (event: {
    name: string;
    path: string;
    err: Error;
    tests: TestCounts;
    durationMs: number;
    attempt: number;
    maxAttempts: number;
  }) => void;
  onTestStart?: (event: {
    flowName: string;
    flowPath: string;
    label: string;
  }) => void;
  onTestResult?: (event: {
    flowName: string;
    flowPath: string;
    label: string;
    status: "pass" | "fail";
    durationMs: number;
    err?: unknown;
  }) => void;
  onScreenshot?: (event: { path: string }) => void;
  onRunComplete?: (event: { summary: RunSummary }) => void;
};
