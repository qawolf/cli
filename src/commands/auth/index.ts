import type { Command } from "commander";

import { withContext } from "../../lib/context.js";
import { handleAuth } from "./auth.js";
import { handleWhoami } from "./whoami.js";

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage authentication with QA Wolf");

  auth.action(withContext(handleAuth));

  auth
    .command("whoami")
    .description("Show authentication status")
    .action(withContext(handleWhoami));
}
