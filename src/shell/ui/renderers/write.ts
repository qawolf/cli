/** JSONL line to stdout (primary command data). */
export function writeJsonLine(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + "\n");
}

/** Raw text to stdout. */
export function writeStdoutRaw(text: string): void {
  process.stdout.write(text);
}

/** JSONL diagnostic line to stderr. */
export function writeJsonDiagnostic(data: unknown): void {
  process.stderr.write(JSON.stringify(data) + "\n");
}

/** Plain text line to stderr. */
export function writeStderrLine(message: string): void {
  process.stderr.write(`${message}\n`);
}
