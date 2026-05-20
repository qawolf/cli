import type { Command } from "commander";

import { withAuthContext, withContext } from "~/commands/context.js";
import { handleLogin } from "./login.js";
import { handleLogout } from "./logout.js";
import { handleWhoami } from "./whoami.js";

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage authentication with QA Wolf");

  auth
    .command("login")
    .description("Authenticate with your QA Wolf API key")
    .action(withContext(handleLogin));

  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(withContext(handleLogout));

  auth
    .command("whoami")
    .description("Show authentication status")
    .action(withAuthContext(handleWhoami));
}
