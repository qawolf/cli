---
"@qawolf/cli": minor
---

Add `qawolf runner inspect session|contexts|page-source|elements`, mobile-only arms alongside the existing browser ones, for a runner's Appium session status, its WebView contexts, the current context's page source, or elements at a point or carrying some text.

`qawolf runner act` now answers `action-not-supported-on-mobile` for an action with no touchscreen equivalent (`double_click`, `scroll`, `move`, `keypress`, `navigate`, or a `click` whose `--button` is not `left`) instead of failing some other way.

This depends on `@qawolf/api-contracts` publishing the `runner.inspectMobile` contract and mobile dispatch added for ARC-556; it ships once that dependency is bumped in a preceding release.
