import { describe, expect, it } from "bun:test";

import { formatGuide } from "./formatGuide.js";

describe("formatGuide", () => {
  it("lays a guide out the way the rest of --help is", () => {
    const source = [
      "# Getting a value back",
      "",
      "exec does not return what the snippet evaluated to, only whether it ran, so print it behind a marker and read it back from the console stream.",
      "",
      "$ qawolf runner events console --tail 20 | jq -r 'select(.source == \"serverConsole\") | .message'",
      "",
      "Entries carry `source`:",
      "- serverConsole is your snippet, and browserConsole is anything the page itself logged to the same stream.",
      "",
    ].join("\n");

    expect(formatGuide(source)).toBe(
      [
        "",
        "Getting a value back:",
        "  exec does not return what the snippet evaluated to, only whether it ran, so",
        "  print it behind a marker and read it back from the console stream.",
        "",
        "  $ qawolf runner events console --tail 20 | jq -r 'select(.source == \"serverConsole\") | .message'",
        "",
        "  Entries carry `source`:",
        "  - serverConsole is your snippet, and browserConsole is anything the page",
        "    itself logged to the same stream.",
      ].join("\n"),
    );
  });
});
