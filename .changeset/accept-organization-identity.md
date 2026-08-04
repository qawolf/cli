---
"@qawolf/cli": minor
---

`qawolf auth whoami` now works with organization and user API keys, not just team keys. With an organization key it shows the organization; with a user key it shows the signed-in user (email) and their organization. Previously any non-team key failed with "Could not verify API key: unexpected response format".
