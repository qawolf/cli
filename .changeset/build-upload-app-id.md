---
"@qawolf/cli": minor
---

`qawolf build upload` takes `--app-id` to name a Windows `.msi` build, whose app ID is otherwise its ProductName, such as "Figma (Machine - MSI)". Flows start it with `launch({ app: { id } })`. It needs `@qawolf/api-contracts` 0.157.0.
