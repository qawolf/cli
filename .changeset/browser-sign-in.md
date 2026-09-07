---
"@qawolf/cli": minor
---

`qawolf auth login` now asks how you want to sign in. Choose `Browser` to sign in with your QA Wolf account, or `API key` to paste a team key as before. The browser option shows a short code, opens the verification page, and waits until you confirm the code. If the CLI cannot open a browser, it prints the URL for you to open.

Browser sign-in uses WorkOS Connect. The CLI reads the sign-in provider and the public client ID from the QA Wolf deployment it points at, so it works against any host that publishes them. The session it stores is bound to that deployment's API URL. A deployment that does not publish a WorkOS Connect configuration says so, and you can run the command again and choose the API key path.

The CLI keeps the session in the system keychain, and falls back to a file that only its owner can read. It refreshes the session automatically before the access token expires, and it keeps the session bound to the same deployment on every refresh. `qawolf auth logout` removes both the session and the API key. An API key still takes precedence over a browser session.

If you point the CLI at a different deployment, it does not reuse the session from the previous one. Sign in again for the new deployment.
