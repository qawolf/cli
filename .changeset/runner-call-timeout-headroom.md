---
"@qawolf/cli": patch
---

Runner calls now wait 90 seconds instead of 60, so the first action on a fresh runner outlives the platform's browser-start wait instead of timing out client-side.
