// These types are shared across command domains until the commands that own
// them are implemented. Move each type to its domain directory when the
// relevant feature lands.
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
