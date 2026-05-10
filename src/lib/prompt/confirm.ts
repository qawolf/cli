// TODO WIZ-10340: wire `confirm` into `qawolf init` on file-collision overwrite.
// TODO WIZ-10355: wire `confirm` into `qawolf flows pull` on overwrite of
// locally-modified `.qawolf/<env>/` files. Both consumers should expose a
// `--yes` CLI flag and pass it through as the `yes` option here.

import { isInteractive } from "~/lib/ui/env.js";

type Listener = (chunk: Buffer | string) => void;
type EndListener = () => void;

type Stdin = {
  readonly isTTY?: boolean | undefined;
  on(event: "data", listener: Listener): unknown;
  on(event: "end", listener: EndListener): unknown;
  off(event: "data", listener: Listener): unknown;
  off(event: "end", listener: EndListener): unknown;
  resume(): unknown;
  pause(): unknown;
};

type Stdout = {
  write(chunk: string): unknown;
};

type ConfirmDeps = {
  readonly stdin?: Stdin;
  readonly stdout?: Stdout;
  readonly env?: Record<string, string | undefined>;
};

type ConfirmOptions = {
  readonly yes: boolean;
} & ConfirmDeps;

export async function confirm(
  message: string,
  {
    yes,
    stdin = process.stdin,
    stdout = process.stdout,
    env = process.env,
  }: ConfirmOptions,
): Promise<boolean> {
  if (yes) return true;
  if (!isInteractive({ stdinIsTTY: stdin.isTTY ?? false, env })) return false;

  stdout.write(`${message} [y/N] `);

  return new Promise<boolean>((resolve) => {
    const settle = (value: boolean) => {
      stdin.off("data", onData);
      stdin.off("end", onEnd);
      stdin.pause();
      resolve(value);
    };
    const onData: Listener = (chunk) => {
      const text = chunk.toString();
      const newlineIdx = text.indexOf("\n");
      const firstLine = newlineIdx >= 0 ? text.slice(0, newlineIdx) : text;
      const input = firstLine.trim().toLowerCase();
      settle(input === "y" || input === "yes");
    };
    const onEnd: EndListener = () => settle(false);

    stdin.on("data", onData);
    stdin.on("end", onEnd);
    stdin.resume();
  });
}
