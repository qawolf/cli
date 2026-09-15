import { defaultSpawn, type SpawnFn } from "./spawn.js";

/** "terminal" when no clipboard tool answered and the terminal was asked instead. */
type ClipboardOutcome = "copied" | "terminal";

export type CopyToClipboard = (text: string) => Promise<ClipboardOutcome>;

type Deps = {
  readonly platform: NodeJS.Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly spawn: SpawnFn;
  /** Where the terminal escape goes when no clipboard tool is installed. */
  readonly writeTerminal: (text: string) => void;
};

type Tool = { readonly cmd: string; readonly args: string[] };

// The system clipboard tools for each platform, most likely first.
function toolsFor(platform: NodeJS.Platform, env: Deps["env"]): Tool[] {
  if (platform === "darwin") return [{ cmd: "pbcopy", args: [] }];
  if (platform === "win32") return [{ cmd: "clip", args: [] }];
  const tools: Tool[] = [];
  if (env["WAYLAND_DISPLAY"]) tools.push({ cmd: "wl-copy", args: [] });
  tools.push(
    { cmd: "xclip", args: ["-selection", "clipboard"] },
    { cmd: "xsel", args: ["--clipboard", "--input"] },
  );
  return tools;
}

export function createCopyToClipboard(deps: Deps): CopyToClipboard {
  return async (text) => {
    for (const tool of toolsFor(deps.platform, deps.env)) {
      // A tool that is not installed is just the next one to try.
      const result = await deps
        .spawn(tool.cmd, tool.args, { platform: deps.platform, stdin: text })
        .catch(() => undefined);
      if (result?.exitCode === 0) return "copied";
    }
    // No tool answered — over SSH, or on a machine without one. OSC 52 asks
    // the terminal itself to set the clipboard, which most modern ones do; it
    // cannot report back, so the caller is told the terminal was asked.
    const encoded = Buffer.from(text, "utf8").toString("base64");
    deps.writeTerminal(`\x1b]52;c;${encoded}\x07`);
    return "terminal";
  };
}

export const copyToClipboard: CopyToClipboard = createCopyToClipboard({
  platform: process.platform,
  env: process.env,
  spawn: defaultSpawn,
  writeTerminal: (text) => {
    process.stdout.write(text);
  },
});
