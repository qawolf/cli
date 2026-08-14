---
"@qawolf/cli": minor
---

The CLI has a new `qawolf issue update` command. It changes the description, name, priority, or status of an issue that the team owns. Fields that you do not give stay unchanged. The command was absent because an earlier contract gave the input as a union of branches, which has no flat set of fields for the command generator to make flags from. The installed contract gives the input as one object, so the generator makes the command from it like the other issue commands.
