import type { SpawnFn } from "./spawn.js";

type OpenBrowserDeps = {
  spawn: SpawnFn;
  platform: NodeJS.Platform;
  sleep: (ms: number) => Promise<void>;
};

/**
 * How long to wait for the launcher before assuming it worked.
 *
 * `open` and `rundll32` hand off and exit at once, but `xdg-open` may run a
 * foreground handler and not return until the browser itself closes. Waiting on
 * that would hold the device flow before it prints its next step or polls once,
 * so the code could expire while the person is looking at an approved page.
 */
const launchTimeoutMs = 2_000;

function launcher(
  url: string,
  platform: NodeJS.Platform,
): { cmd: string; args: string[] } {
  if (platform === "darwin") return { cmd: "open", args: [url] };
  // rundll32 hands the URL straight to the shell's protocol handler. `start`
  // would be the usual answer, but it only exists inside cmd.exe, and routing a
  // server-supplied URL through a command interpreter invites injection.
  if (platform === "win32") {
    return { cmd: "rundll32", args: ["url.dll,FileProtocolHandler", url] };
  }
  return { cmd: "xdg-open", args: [url] };
}

/**
 * Opens a verification URL in the person's browser.
 *
 * Best-effort by design: the caller always prints the URL as well, so a
 * headless box, a missing launcher, or a locked-down desktop costs a copy and
 * paste rather than the whole flow. Never throws.
 */
export async function openBrowser(
  url: string,
  deps: OpenBrowserDeps,
): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // The URL arrives from a network response, so the scheme is checked before it
  // reaches a protocol handler that would happily act on file: or a custom one.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  const { cmd, args } = launcher(url, deps.platform);

  // Settled either way so a launcher that fails after the timeout cannot reject
  // unobserved.
  const launched = deps
    .spawn(cmd, args, { platform: deps.platform })
    .then((result) => result.exitCode === 0)
    .catch(() => false);

  // A launcher still running at the timeout is treated as success: it is far
  // likelier to be holding a browser open than to be about to fail, and saying
  // "could not open" over a browser that did open only confuses.
  return Promise.race([launched, deps.sleep(launchTimeoutMs).then(() => true)]);
}
