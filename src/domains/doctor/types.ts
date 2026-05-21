type CheckStatus = "pass" | "warn" | "fail";

export type CheckResult = {
  readonly name: string;
  readonly status: CheckStatus;
  readonly version?: string;
  readonly detail?: string;
};
