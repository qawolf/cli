---
"@qawolf/cli": patch
---

Fix Windows runs failing with "Could not load @qawolf/testkit ... Received protocol 'c:'". The Node ESM loader requires file:// URLs for absolute paths on win32, so the testkit, Playwright, and emails loaders now convert resolved paths before dynamic import.
