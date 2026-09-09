---
"@qawolf/cli": minor
---

A prompt that shows more than eight items now lets you type to filter the list. This applies to the organization and the workspace prompts, where an account that reaches many organizations gets a long list.

The filter matches a name, a slug, or an id. It ignores letter case, and it reads a space and a hyphen as the same character, so `acme retail` finds `acme-retail`. The arrow keys and Enter continue to operate as before, and an empty filter box shows the full list.
