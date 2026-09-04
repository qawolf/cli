---
"@qawolf/cli": minor
---

`qawolf auth login` now asks how you want to sign in. Choose `Browser` to sign in with your QA Wolf account, or `API key` to paste a team key as before. The browser option shows a short code, opens the verification page, and waits until you confirm the code. If the CLI cannot open a browser, it prints the URL for you to open.

The CLI keeps the session in the system keychain, and falls back to a file that only its owner can read. It refreshes the session automatically before the access token expires, and `qawolf auth logout` removes both the session and the API key. An API key still takes precedence over a browser session.

Browser sign-in needs no configuration: the CLI asks the QA Wolf deployment it points at which sign-in application to use, so it works against any host. A deployment that offers no browser sign-in says so, and you can run the command again and choose the API key path.
