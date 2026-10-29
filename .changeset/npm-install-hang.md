---
"@qawolf/cli": patch
---

`npm install @qawolf/cli` and `npx @qawolf/cli` finish again instead of running forever at full CPU. The CLI no longer installs `@qawolf/flows`, `@qawolf/testkit` and Playwright next to itself; it already installed its own copies before each run.
