---
"@qawolf/cli": minor
---

After a browser sign-in, the CLI now asks which organization to work in, then which workspace inside it. It asks only when there is more than one to choose from.

The new `qawolf auth switch` command changes the workspace later without signing in again. Set `QAWOLF_WORKSPACE` to choose without a prompt. It accepts a workspace name, slug, or id, and finds the organization for you. Add `QAWOLF_ORGANIZATION`, which accepts an organization name or id, when the same workspace name occurs in more than one organization.

Public API commands send the workspace you chose, so a change takes effect immediately. Changing workspace needs no new token. `qawolf auth whoami` lists the workspaces each of your organizations contains.

A browser sign-in is granted to one organization, and the CLI offers only the workspaces in that organization. To work in a different organization, run `qawolf auth login` again and sign in to it. A `QAWOLF_ORGANIZATION` or `QAWOLF_WORKSPACE` value outside the granted organization is reported as an error, and the CLI does not switch to it.
