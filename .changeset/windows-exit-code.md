---
"@qawolf/cli": patch
---

Commands that read the platform API now exit with their own status code on Windows. The CLI stopped the process as soon as a command was complete. If the reply was still in the process of teardown, Windows builds of Node stopped with an assertion failure, and the crash code replaced the code of the command. The output was correct, but a script could not tell success from an authentication failure or a refused payment. The CLI now records the status code and lets the work that is in progress complete. A 2 second backstop stops a run that keeps the event loop busy, which is what a flow run does with its browsers.

The update check no longer keeps a request open after the command is complete. This made each command that used the npm registry lookup approximately 250 ms slower.
