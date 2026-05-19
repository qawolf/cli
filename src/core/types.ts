export type BrowserName = "chromium" | "firefox" | "webkit";

export type VideoMode = "on" | "off" | "retain-on-failure";

export type TraceMode = "on" | "off" | "retain-on-failure";

export type HarMode = "on" | "off" | "retain-on-failure";

export type HarContent = "full" | "omit";

export type TestCounts = {
  passed: number;
  total: number;
};
