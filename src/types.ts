export type BrowserName = "chromium" | "firefox" | "webkit";

export type VideoMode = "on" | "off" | "retain-on-failure";

export type TraceMode = "on" | "off" | "retain-on-failure";

export type HarMode = "on" | "off" | "retain-on-failure";

export type StepCounts = {
  passed: number;
  total: number;
};

export type CliOptions = {
  outputDir: string;
  timeout: number;
  retries: number;
  bail: boolean;
  workers: number;
  video: VideoMode;
  trace: TraceMode;
  har: HarMode;
};
