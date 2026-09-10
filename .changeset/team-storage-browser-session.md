---
"@qawolf/cli": patch
---

`qawolf flows pull` now downloads team-storage assets when you sign in through the browser. Before, the pull stopped with "Team storage requires a team API key" after it had already downloaded the flows and the environment variables.

The CLI asked the API who the credential belonged to, and used the team from the answer. A browser session has an organization and a user in that answer, but no team, so the CLI refused it. A browser session does name the workspace you chose, and a workspace is a team, so the CLI now uses that.

An organization API key with no workspace still gets the same message, because such a key reaches many teams and names none.
