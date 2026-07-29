---
"@qawolf/cli": minor
---

Add `--no-browser-deps` to `flows run`, `install`, and `install browsers`. On Linux the CLI runs `playwright install --with-deps`, whose OS dependency step shells out to `apt-get` and needs root — on non-root machines without sudo it hangs or fails at a `su` prompt (`playwright install chromium failed: Password:`) even when every system library is already installed. The new flag skips that step and only installs the browsers themselves, so non-root environments with preinstalled system libraries (for example CI images baked with `playwright install-deps`, or a shared `PLAYWRIGHT_BROWSERS_PATH` cache) can run web flows. Default behavior is unchanged; if libraries are missing at launch, Playwright reports the exact packages to install.
