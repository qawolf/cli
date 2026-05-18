export class FailWithoutRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FailWithoutRetryError";
  }
}

export class FlowRunError extends Error {
  readonly flowName: string;
  readonly attempt: number;

  constructor(flowName: string, attempt: number, cause: unknown) {
    super(`Flow "${flowName}" failed on attempt ${attempt}`, { cause });
    this.name = "FlowRunError";
    this.flowName = flowName;
    this.attempt = attempt;
  }
}
