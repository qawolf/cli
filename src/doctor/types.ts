type CheckStatus = "pass" | "warn" | "fail";

export type CheckResult = {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail?: string;
};

export type SpawnResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type SpawnFn = (cmd: string, args: string[]) => Promise<SpawnResult>;
