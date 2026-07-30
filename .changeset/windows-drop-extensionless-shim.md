---
"@qawolf/cli": patch
---

Stop accepting the extension-less Playwright and Appium shims on Windows. Windows cannot launch those shims. `CreateProcess` reports `ENOENT` for a path with no executable extension, even when the file is present. The CLI still counted such a shim as usable. So `qawolf doctor` reported Playwright as installed, and `qawolf flows run` then failed with an error naming a file the user can see on disk. The runtime check also read such a directory as fully installed. The CLI now looks only for the `.cmd` and `.exe` shims on Windows. A project directory that holds only the extension-less shim is now rejected, and the CLI installs its managed runtime instead. This affects a `node_modules` directory installed on Linux or macOS and then used from Windows, through a bind mount, a copied tree, or WSL. A project installed on Windows by npm or bun is unaffected.
