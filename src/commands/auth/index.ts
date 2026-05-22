import type { Command } from "commander";

import { withAuthContext, withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { handleLogin } from "./login.js";
import { handleLogout } from "./logout.js";
import { handleWhoami } from "./whoami.js";

export function registerAuthCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const auth = program
    .command("auth")
    .description("Manage authentication with QA Wolf");

  auth
    .command("login")
    .description("Authenticate with your QA Wolf API key")
    .action(withContext(signals, handleLogin));

  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(withContext(signals, handleLogout));

  auth
    .command("whoami")
    .description("Show authentication status")
    .action(withAuthContext(signals, handleWhoami));
}
