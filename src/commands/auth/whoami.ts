import { resolveApiKey } from "../../lib/auth/index.js";
import { authCopy } from "../../lib/copy/index.js";
import type { UIContext } from "../../lib/ui/index.js";

export async function handleWhoami(
  ui: UIContext,
  configDir: string,
): Promise<void> {
  const resolved = await resolveApiKey(configDir);

  if (!resolved) {
    ui.error(authCopy.ci.errorTitle, authCopy.ci.errorBody);
    process.exitCode = 1;
    return;
  }

  if (ui.mode === "human") {
    ui.gap();
    ui.intro(authCopy.title);
    ui.note(`Source: ${resolved.source}`, authCopy.whoamiAuthenticated);
    ui.outro(authCopy.outroReady);
  } else {
    ui.output(
      { authenticated: true, source: resolved.source },
      `Authenticated (source: ${resolved.source})`,
    );
  }
}
