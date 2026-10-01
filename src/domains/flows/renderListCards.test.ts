import { describe, expect, it } from "bun:test";

import { displayWidth } from "~/core/displayWidth.js";

import { renderListCards } from "./renderListCards.js";
import type { FlowsListRow } from "./renderListTable.js";

const row = (over: Partial<FlowsListRow> = {}): FlowsListRow => ({
  name: "Login",
  target: "Web - Chrome",
  file: ".qawolf/env-a/src/flows/login.flow.ts",
  env: undefined,
  tags: undefined,
  flowId: undefined,
  ...over,
});

const plain = (rows: FlowsListRow[], width: number): string =>
  renderListCards(rows, { styled: false, width });

describe("renderListCards", () => {
  it("lists every tag rather than truncating", () => {
    const out = plain(
      [row({ tags: ["A_ONE", "B_TWO", "C_THREE", "D_FOUR", "E_FIVE"] })],
      200,
    );
    expect(out).toContain("A_ONE, B_TWO, C_THREE, D_FOUR, E_FIVE");
    expect(out).not.toContain("more");
  });

  it("wraps a long list between whole names, aligned under the value", () => {
    const out = plain(
      [
        row({
          tags: [
            "example-category-a",
            "example-category-b",
            "example-category-c",
            "example-category-d",
          ],
        }),
      ],
      40,
    );
    expect(out).toContain(
      [
        "  tags      example-category-a,",
        "            example-category-b,",
        "            example-category-c,",
        "            example-category-d",
      ].join("\n"),
    );
  });

  it.each([
    { tags: ["登录".repeat(4), "付款".repeat(4)] },
    { tags: ["a".repeat(13), "b".repeat(13), "c"] },
  ])("wraps by display width including trailing separators: %j", ({ tags }) => {
    const out = plain([row({ tags })], 40);
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(40);
    }
    for (const tag of tags) expect(out).toContain(tag);
  });

  it("keeps combining characters together when their display widths fit", () => {
    const tags = ["e\u0301".repeat(10), "y".repeat(10)];
    expect(plain([row({ tags })], 40)).toContain(tags.join(", "));
  });

  it("keeps a wide Unicode value whole on its own line", () => {
    const tag = "登录".repeat(20);
    expect(plain([row({ tags: [tag] })], 40)).toContain(tag);
  });

  it("gives an item wider than the terminal its own line, whole", () => {
    const long = "a-tag-name-far-wider-than-the-column";
    const out = plain([row({ tags: ["SHORT", long] })], 20);
    expect(out).toContain(long);
  });

  it("omits fields with nothing to show", () => {
    const out = plain([row()], 200);
    expect(out).not.toContain("tags");
  });

  it("says a shared pulled prefix once, above the cards", () => {
    const out = plain(
      [
        row(),
        row({
          name: "Checkout",
          file: ".qawolf/env-a/src/flows/checkout.flow.ts",
        }),
      ],
      200,
    );
    expect(out.split("\n")[0]).toBe("in .qawolf/env-a/");
    expect(out.split(".qawolf/env-a/").length - 1).toBe(1);
    expect(out).toContain("  file      src/flows/login.flow.ts");
  });

  it("keeps full paths and shows the env when rows come from several places", () => {
    const out = plain(
      [
        row({ env: "staging", file: ".qawolf/env-a/src/flows/a.flow.ts" }),
        row({ name: "Local", file: "src/flows/local.flow.ts" }),
      ],
      200,
    );
    expect(out).not.toContain("in .qawolf");
    expect(out).toContain("  env       staging");
    expect(out).toContain(".qawolf/env-a/src/flows/a.flow.ts");
  });

  it("bolds the name only when styled", () => {
    expect(renderListCards([row()], { styled: true, width: 200 })).toContain(
      "\x1b[1mLogin\x1b[22m",
    );
    expect(plain([row()], 200)).not.toContain("\x1b");
  });
});

describe("renderListCards flow ids", () => {
  it("shows the flow id when it is known", () => {
    expect(plain([row({ flowId: "flow-123" })], 200)).toContain(
      "  id        flow-123",
    );
  });

  it("leaves the id line out when it is not", () => {
    expect(plain([row()], 200)).not.toContain("  id ");
  });
});
