---
"@qawolf/cli": patch
---

Flows that import `startWireGuard` from `@qawolf/testkit` no longer fail with `SyntaxError: The requested module '@qawolf/testkit' does not provide an export named 'startWireGuard'`. The CLI now installs `@qawolf/testkit` 1.2.1, the version that exports the helper.
