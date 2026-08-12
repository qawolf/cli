export const exitCodes = {
  success: 0,
  testFailure: 1,
  invalidArgs: 2,
  auth: 3,
  network: 4,
  config: 5,
  timeout: 6,
} as const;

type ExitCode = (typeof exitCodes)[keyof typeof exitCodes];

type ExitProcess = {
  readonly stderr: { readonly write: (chunk: string) => unknown };
  readonly exit: (code: number) => never;
};

export function exit(
  code: ExitCode,
  message?: string,
  proc: ExitProcess = process,
): never {
  if (message !== undefined && message.length > 0) {
    proc.stderr.write(`${message}\n`);
  }
  return proc.exit(code);
}

type FlushExitProcess = {
  readonly stdout: {
    readonly write: (chunk: string, cb: () => void) => unknown;
  };
  readonly stderr: {
    readonly write: (chunk: string, cb: () => void) => unknown;
  };
  readonly exit: (code: number) => never;
};

/**
 * Flush stdout and stderr, then exit with `code`. The flow runtime can leave
 * browser processes and CDP sockets the event loop never drains, so the CLI
 * exits deterministically once its command resolves. The empty-`write`
 * callbacks flush buffered output first; the backstop forces exit if a stream
 * stalls (e.g. EPIPE on a closed pipe).
 */
export function flushAndExit(
  code: number,
  proc: FlushExitProcess = process,
  scheduleBackstop: (fn: () => void) => void = (fn) => {
    setTimeout(fn, 2000).unref();
  },
): void {
  let exited = false;
  const exitOnce = (): void => {
    if (exited) return;
    exited = true;
    proc.exit(code);
  };

  let pending = 2;
  const onFlushed = (): void => {
    pending -= 1;
    if (pending === 0) exitOnce();
  };
  proc.stdout.write("", onFlushed);
  proc.stderr.write("", onFlushed);

  scheduleBackstop(exitOnce);
}
