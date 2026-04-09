export function createJson(): (data: unknown) => void {
  return (data: unknown): void => {
    process.stdout.write(JSON.stringify(data) + "\n");
  };
}
