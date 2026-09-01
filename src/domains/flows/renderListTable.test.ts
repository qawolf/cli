import { describe, expect, it } from "bun:test";

import { renderListTable, type FlowsListRow } from "./renderListTable.js";

const row = (over: Partial<FlowsListRow> = {}): FlowsListRow => ({
  name: "Login",
  target: "Web - Chrome",
  file: "src/flows/login.flow.ts",
  tags: undefined,
  ...over,
});

const headerOf = (out: string): string => out.split("\n")[0] ?? "";

describe("renderListTable", () => {
  it("renders only name, target and file when there is nothing else to show", () => {
    const out = renderListTable([row()], false);
    expect(headerOf(out).split(/\s{2,}/)).toEqual(["name", "target", "file"]);
  });

  // Tagging is sparse, so most listings should not gain a tags column.
  it("omits the tags column when no flow is tagged", () => {
    const out = renderListTable(
      [row({ tags: [] }), row({ tags: undefined })],
      false,
    );
    expect(headerOf(out)).not.toContain("tags");
  });

  it("adds the tags column and joins tags when some flow is tagged", () => {
    const out = renderListTable(
      [row({ tags: ["auth", "smoke"] }), row({ tags: [] })],
      false,
    );
    expect(headerOf(out)).toContain("tags");
    expect(out).toContain("auth, smoke");
  });

  it("keeps file last when every column is shown", () => {
    const out = renderListTable([row({ tags: ["auth"] })], false);
    const header = headerOf(out);
    expect(header.indexOf("tags")).toBeGreaterThan(header.indexOf("target"));
    expect(header.indexOf("file")).toBeGreaterThan(header.indexOf("tags"));
  });

  it("bolds the header when asked", () => {
    const out = renderListTable([row()], true);
    expect(headerOf(out)).toStartWith("\x1b[1m");
    expect(headerOf(out)).toEndWith("\x1b[0m");
  });

  it("pads columns so every row starts its target at the same column", () => {
    const out = renderListTable(
      [row({ name: "A" }), row({ name: "A much longer flow name" })],
      false,
    );
    const [, short, long] = out.split("\n");
    expect(short?.indexOf("Web - Chrome")).toBe(
      long?.indexOf("Web - Chrome") ?? -1,
    );
    expect(short?.indexOf("Web - Chrome")).toBeGreaterThan(
      "A much longer flow name".length,
    );
  });
});
