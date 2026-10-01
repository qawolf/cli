import { describe, expect, it } from "bun:test";

import { fitListTable } from "./fitListTable.js";
import type { FlowsListRow } from "./renderListTable.js";

// oxlint-disable-next-line no-control-regex
const strip = (s: string): string => s.replace(/\x1b\[[\d;]*m/g, "");

const path = "src/flows/account/view-order-items.flow.ts";

const row = (over: Partial<FlowsListRow> = {}): FlowsListRow => ({
  name: "View Order Items",
  target: "Web - Chrome",
  file: `.qawolf/env-a/${path}`,
  env: undefined,
  tags: ["Smoke Tests", "CI"],
  flowId: undefined,
  ...over,
});

const plainLine = (rows: FlowsListRow[], width: number, of = row()): string =>
  strip(fitListTable(rows, width).line(of));

describe("fitListTable", () => {
  it("keeps every cell whole when the table fits", () => {
    const line = plainLine([row()], 300);
    expect(line).toContain("View Order Items");
    expect(line).toContain(path);
    expect(line).not.toContain("…");
  });

  it("drops the shared pulled prefix from the file column", () => {
    expect(plainLine([row()], 300)).not.toContain(".qawolf/env-a/");
  });

  it("fits every line within the width, cutting cells with an ellipsis", () => {
    const table = fitListTable([row()], 60);
    expect(table.header.length).toBeLessThanOrEqual(60);
    expect(strip(table.line(row())).length).toBeLessThanOrEqual(60);
    expect(strip(table.line(row()))).toContain("…");
  });

  // The path is the widest cell here, so it gives way first.
  it("cuts the widest column before any other", () => {
    const line = plainLine([row()], 80);
    expect(line).toContain("View Order Items");
    expect(line).toContain("Web - Chrome");
    expect(line).toContain("…");
  });

  it.each([0, 1, 5, 10, 20, 40])(
    "fits headers and rows within %i columns",
    (width) => {
      const table = fitListTable([row()], width);
      expect(Bun.stringWidth(table.header)).toBeLessThanOrEqual(width);
      expect(Bun.stringWidth(table.line(row()))).toBeLessThanOrEqual(width);
    },
  );

  it("fits CJK, emoji and combining characters by display columns", () => {
    const item = row({ name: "登录".repeat(10), file: "src/👩🏽‍💻/café.flow.ts" });
    const table = fitListTable([item], 77);
    expect(Bun.stringWidth(table.line(item))).toBeLessThanOrEqual(77);
  });

  it("draws rows other than the ones it was laid out from", () => {
    expect(
      plainLine([row(), row({ name: "Other" })], 300, row({ name: "Other" })),
    ).toContain("Other");
  });

  // Cut from the end, a path keeps `src/flows/…` — the part every flow shares.
  it("keeps the file name when a path has to be cut", () => {
    expect(plainLine([row()], 75)).toMatch(/…\S*view-order-items\.flow\.ts$/);
  });

  it("dims the folder and leaves the file name bright", () => {
    expect(fitListTable([row()], 300).line(row())).toContain(
      "\x1b[2msrc/flows/account/\x1b[22mview-order-items.flow.ts",
    );
  });

  it("dims the secondary columns, not the name", () => {
    const line = fitListTable([row()], 300).line(row());
    expect(line).toContain("\x1b[2mWeb - Chrome");
    expect(line).toStartWith("View Order Items");
  });
});
