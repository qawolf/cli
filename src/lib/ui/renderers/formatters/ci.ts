export function formatCIError(title: string, body?: string): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`ERROR  ${title}`);
  if (body) {
    lines.push("");
    for (const line of body.split("\n")) {
      lines.push(line);
    }
  }
  lines.push("");
  return lines.join("\n");
}
