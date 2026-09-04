import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { handleLogin } from "./login.js";
import { handleLogout } from "./logout.js";
import { handleSwitchWorkspace } from "./switchWorkspace.js";
import { handleWhoami } from "./whoami.js";

export function registerAuthCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const auth = program
    .command("auth")
    .description("Manage authentication with QA Wolf");

  declareCommandKind(auth.command("login"), "local")
    .description("Authenticate with QA Wolf in a browser or with an API key")
    .action(withContext(signals, handleLogin));

  declareCommandKind(auth.command("logout"), "local")
    .description("Remove stored credentials")
    .action(withContext(signals, handleLogout));

  declareCommandKind(auth.command("switch"), "read")
    .description("Choose which workspace to work in")
    .action(withContext(signals, handleSwitchWorkspace));

  declareCommandKind(auth.command("whoami"), "read")
    .description("Show authentication status")
    .action(withContext(signals, handleWhoami));
}
