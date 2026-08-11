---
"@qawolf/cli": patch
---

Make `init` repair an existing package.json so the scaffolded flow can load. The scaffolded flow and config are ES modules. Node reads their module format from the nearest package.json `type` field. Before this change, `init` only added the `test:e2e` script to an existing package.json. It did not set `"type": "module"` and did not add the `@qawolf/flows` dependency, so the example flow failed to load. Current npm writes `"type": "commonjs"` into every `npm init -y` package.json, so an explicit value does not signal author intent. `init` now offers three changes in one prompt: add the `test:e2e` script, set `"type": "module"`, and add the `@qawolf/flows` dependency. It applies the missing ones and skips the rest. It prints a warning after it changes an explicit `type` value, because that changes how every `.js` file in the package loads. Run `init` again on a half-configured project to repair it; the old code stopped at the first existing script.
