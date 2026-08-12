/**
 * Everything piped in, as text. Used by commands that accept `-` for a file.
 *
 * A terminal reads as nothing piped in, rather than as a stream that ends only
 * when someone types Ctrl-D. `qawolf runner act -` with the pipe forgotten would
 * otherwise sit there silently, and the caller most likely to get that wrong is
 * an agent, which has no Ctrl-D to press.
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY === true) return "";
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks).toString("utf8");
}
