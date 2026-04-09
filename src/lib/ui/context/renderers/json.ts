export function writeJsonLine(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + "\n");
}

export function createJson(): (data: unknown) => void {
  return writeJsonLine;
}
