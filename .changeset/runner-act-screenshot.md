---
"@qawolf/cli": minor
---

`qawolf runner act --screenshot <path>` asks the runner to answer with a JPEG of its screen after the action and writes it the way `runner screenshot` does: to the file, or to stdout with `-`. One call per computer-use step in place of act, a wait and screenshot. An action that reached the screen and did not take effect answers with a screenshot too, so a refusal still leaves a picture of why.
