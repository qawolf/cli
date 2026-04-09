import type { Command } from "commander";

import { resolveApiKey } from "../../lib/auth/index.js";
import { authCopy } from "../../lib/copy/index.js";
import { getConfigDir } from "../../lib/paths.js";
import { withUI } from "../../lib/withUI.js";
import { handleLogin } from "./login.js";
import { handleWhoami } from "./whoami.js";

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage authentication with QA Wolf");

  auth.action(
    withUI(async (ui) => {
      const configDir = getConfigDir();

      if (ui.mode !== "human") {
        const resolved = await resolveApiKey(configDir);
        if (!resolved) {
          ui.error(authCopy.ci.errorTitle, authCopy.ci.errorBody);
          process.exitCode = 1;
        }
        return;
      }

      await handleLogin(ui, configDir);
    }),
  );

  auth
    .command("whoami")
    .description("Show authentication status")
    .action(
      withUI(async (ui) => {
        const configDir = getConfigDir();
        await handleWhoami(ui, configDir);
      }),
    );
}
