export const exitCodes = {
  success: 0,
  testFailure: 1,
  invalidArgs: 2,
  auth: 3,
  network: 4,
  config: 5,
  timeout: 6,
  payment: 7,
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

type ExitingProcess = {
  exitCode: number | string | undefined;
  readonly exit: (code: number) => never;
};

/**
 * How long a process that cannot drain on its own is left to finish. Long
 * enough for an outstanding socket teardown or a stdout write to a slow reader
 * to land, and only ever waited out by a command that holds the loop open.
 */
const backstopMs = 2000;

/**
 * Records `code` as the exit status and lets the event loop drain, rather than
 * killing the process where the command finished. Tearing down mid-flight I/O
 * aborts a Windows build of Node ("Assertion failed:
 * !(handle->flags & UV_HANDLE_CLOSING), src\\win\\async.c"), which replaces the
 * command's own exit code with a crash code — so a caller reads a successful
 * command as a failure.
 *
 * The flow runtime still leaves browser processes and CDP sockets the loop
 * never drains, so the backstop forces the exit those runs need. Its timer is
 * unref'd: it fires only while something else holds the loop open, and a
 * command that has nothing left in flight exits before it ever comes due.
 */
export function exitWhenIdle(
  code: number,
  proc: ExitingProcess = process,
  scheduleBackstop: (fn: () => void) => void = (fn) => {
    setTimeout(fn, backstopMs).unref();
  },
): void {
  proc.exitCode = code;
  scheduleBackstop(() => proc.exit(code));
}
