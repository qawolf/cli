---
"@qawolf/cli": minor
---

Update `@qawolf/api-contracts` to 0.11.0, expanding the generated command
surface: `automate`, `environment create|get|listVariableNames`,
`issue create|find|get`, `run find|get`, and `tag create` join the existing
`run create` and `flows list --remote`.

Contract inputs expressed as intersections (`run.create`, which now selects
flows by id and/or tag) or discriminated unions (`issue.create`, bug vs
coverage request) are now mapped to flags: intersection members merge into
one flag set, and a union's literal discriminator becomes a required flag
(`--type`, documented as "One of: bug, coverageRequest") with
branch-specific fields optional. Validation still runs against the real
contract schema before any network call, so branch rules and cross-field
constraints keep their precise error messages.
