import { describe, expect, it } from "bun:test";

import { serializeSnapshotToHtml } from "./snapshotHtmlProjection.js";

describe("serializeSnapshotToHtml", () => {
  it("omits active embedded documents", () => {
    const result = serializeSnapshotToHtml({
      attrs: {},
      children: [
        {
          attrs: { data: "data:text/html,<script>parent.pwned=true</script>" },
          children: ["unsafe fallback"],
          tag: "OBJECT",
        },
        {
          attrs: { srcdoc: "<script>parent.pwned=true</script>" },
          children: [],
          tag: "IFRAME",
        },
        "safe text",
      ],
      tag: "DIV",
    });

    expect(result.html).toBe("<div>safe text</div>");
    expect(result.html).not.toContain("data:text/html");
    expect(result.html).not.toContain("srcdoc");
  });
});
