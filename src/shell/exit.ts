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

type SignalName = "SIGINT" | "SIGTERM";

const signalExitCodes: Record<SignalName, number> = {
  SIGINT: 130,
  SIGTERM: 143,
};

/**
 * How long a signalled process is left to finish. Long enough for the I/O that
 * was in flight when the signal landed, short enough to read as immediate.
 */
const signalGraceMs = 150;

/** Schedules the grace period between a signal and the exit it forces. */
export function scheduleSignalGrace(
  fn: () => void,
): ReturnType<typeof setTimeout> {
  // Holds the event loop open, unlike the backstop in `exitWhenIdle`. The exit
  // status is one mutable value: a command that settles inside the grace
  // overwrites the signal's code with its own, so only a timer certain to fire
  // can exit on the code the signal chose.
  return setTimeout(fn, signalGraceMs);
}

/**
 * Builds the handler for `signal`, sharing one "already signalled" flag across
 * every signal it builds.
 *
 * The first signal runs `shutdown`, then records the exit status and leaves a
 * short moment for work in flight — killing the process here reaches the same
 * win32 abort `exitWhenIdle` describes, and loses the 130 or 143 with it. The
 * moment is short rather than absent because a signal, unlike a finished
 * command, arrives while the event loop is still busy: waiting for it to drain
 * would mean the command runs to completion and prints, which is not what an
 * interrupt asks for.
 *
 * A second signal exits at once. That is the deliberate escape hatch for a
 * process whose cleanup will not finish, so it keeps its hard exit.
 */
export function createSignalExit(deps: {
  shutdown: (reason: string) => Promise<void>;
  proc?: ExitingProcess;
  scheduleGrace?: (fn: () => void) => void;
}): (signal: SignalName) => () => void {
  const proc = deps.proc ?? process;
  const scheduleGrace = deps.scheduleGrace ?? scheduleSignalGrace;

  let signalled = false;
  return (signal) => () => {
    const code = signalExitCodes[signal];
    if (signalled) proc.exit(code);
    signalled = true;
    void deps
      .shutdown(signal)
      // A shutdown that rejects would reach the process as an unhandled
      // rejection, and the default handling replaces the signal's code with 1
      // — the loss this function exists to prevent. The registry settles its
      // own cleanups, so this guards the type rather than a caller we have.
      .catch(() => {})
      .finally(() => exitWhenIdle(code, proc, scheduleGrace));
  };
}
