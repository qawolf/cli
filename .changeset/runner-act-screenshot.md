---
"@qawolf/cli": minor
---

`qawolf runner act --screenshot <path>` asks the runner to answer with a JPEG of its screen once it has settled after the action, and writes it the way `runner screenshot` does: to the file, or to stdout with `-`. One call per computer-use step in place of act, a fixed wait and screenshot. Needs the `@qawolf/api-contracts` release that adds the option to `runner.performAction`.
