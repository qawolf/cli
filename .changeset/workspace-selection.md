---
"@qawolf/cli": minor
---

After a browser sign-in, the CLI now asks which organization to work in, then which workspace inside it. It asks only when there is more than one to choose from.

The new `qawolf auth switch` command changes the workspace later without signing in again. Set `QAWOLF_ORGANIZATION` or `QAWOLF_WORKSPACE` to choose without a prompt; both accept a name, a slug, or an id.

Commands send the workspace you chose, so a change takes effect immediately. Changing workspace inside an organization needs no new token. `qawolf auth whoami` lists the workspaces each of your organizations contains.
