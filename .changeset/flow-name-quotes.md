---
"@qawolf/cli": patch
---

The CLI now reads flow names that contain quote characters.

Before this change, the parser stopped the name at the first single quote or double quote. The parser ignored which quote started the name. Thus the name `Shopper's cart` became `Shopper`. The parser also did not find the target of that flow. A flow without a target does not run. Therefore `qawolf flows run` skipped the flow and showed the message `No flows matched.` The command `qawolf flows list` showed the short name.

The parser now records the quote that starts the name. It also accepts a backslash before a quote. Thus the parser correctly reads the names `"Say \"hi\""` and `'Shopper\'s cart'`. The parser accepts a name in backticks. A name that contains `${...}` stays dynamic, because the value is only available at run time.

Two more target forms now work. The CLI reads the target from an options object that contains a second object before the `target` key. The CLI also reads a target in backticks.
