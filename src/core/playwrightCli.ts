import { join } from "node:path";

/** Path of the playwright package's own CLI entry inside an env dir. */
export function playwrightCliJsPath(envDir: string): string {
  return join(envDir, "node_modules", "playwright", "cli.js");
}

export type PlaywrightCliInvocation = {
  cmd: string;
  args: string[];
  env: Record<string, string>;
};

// The node_modules/.bin/playwright shim is winner-takes-all across every
// installed package that declares a `playwright` bin (e.g. @playwright/test),
// so it can belong to a different playwright version than the module the flow
// runtime imports — and then `install` downloads a browser build the runtime
// cannot launch. Running the playwright package's own cli.js pins the spawned
// CLI to the exact package the runtime resolves. BUN_BE_BUN makes a compiled
// qawolf binary execute the script as a plain Bun runtime instead of
// re-entering the CLI; node and non-compiled bun ignore it.
export function playwrightCliInvocation(args: {
  envDir: string;
  execPath: string;
  cliArgs: readonly string[];
}): PlaywrightCliInvocation {
  return {
    cmd: args.execPath,
    args: [playwrightCliJsPath(args.envDir), ...args.cliArgs],
    env: { BUN_BE_BUN: "1" },
  };
}
