export const exitCodes = {
  success: 0,
  testFailure: 1,
  invalidArgs: 2,
  auth: 3,
  network: 4,
  config: 5,
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
