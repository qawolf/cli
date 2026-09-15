---
"@qawolf/cli": patch
---

`qawolf flows pull`, and the runs that pull on your behalf, now mirror team-storage assets with an organization or user API key. The pull used to stop with "Team storage requires a team API key" because such a key reaches many teams and names none. The environment being pulled names its team, so the pull now reads that team's storage. A team API key and a browser session behave as before.
