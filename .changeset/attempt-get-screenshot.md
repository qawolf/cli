---
"@qawolf/cli": minor
---

Upgrade `@qawolf/api-contracts` to `0.160.0`.

- `qawolf attempt getScreenshot` reads one screenshot from a finished attempt's trace, the one nearest `--at` or the one at `--index`, without downloading the trace, so it works on traces too large for `qawolf attempt inspect`.
- A generated command whose answer carries an image as `imageJpegBase64` takes `--output-file <path>`. It writes the JPEG there, refusing to overwrite an existing file, and prints the rest of the answer without the base64.
- Also in this upgrade: `qawolf deployment findLastDeployedCommit`, `qawolf build create --app-id`, Windows `.msi` and Mac `.zip` builds in `qawolf build requestUpload`, and `qawolf promotion askQuestion` and `promotion reportDecision` marked deprecated.
