---
"@qawolf/cli": patch
---

The help for a generated command now lists the permitted values of a flag that accepts a closed set, such as `qawolf issue update --status` or `qawolf issue find --statuses`. Before, these flags showed no values, and a caller found them only from the error message of a rejected command. The values come from the contract, so they cannot disagree with what the API accepts. A flag that already has help text keeps it, and the values come after it.
