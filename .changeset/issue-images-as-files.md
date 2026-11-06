---
"@qawolf/cli": patch
---

Issue commands print each image in an issue description as a file path instead of raw base64, so an agent can open the screenshot and a page of issues fits in its output. When you write such a description back with `issue update` or `issue create`, the CLI reads those files and sends the images inline, so no image is lost.
