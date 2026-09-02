import { describe, expect, it } from "bun:test";

import { renderListTable, type FlowsListRow } from "./renderListTable.js";

const row = (over: Partial<FlowsListRow> = {}): FlowsListRow => ({
  name: "Login",
  target: "Web - Chrome",
  file: "src/flows/login.flow.ts",
  env: undefined,
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

describe("renderListTable env column", () => {
  // One pulled env puts the same value on every row, which tells you nothing.
  it("omits the env column when every flow is from one environment", () => {
    const out = renderListTable(
      [row({ env: "staging" }), row({ env: "staging" })],
      false,
    );
    expect(headerOf(out)).not.toContain("env");
  });

  it("omits the env column when no flow is from a pulled environment", () => {
    const out = renderListTable([row(), row()], false);
    expect(headerOf(out)).not.toContain("env");
  });

  // The same flow pulled into two environments is otherwise distinguishable
  // only by the opaque id buried in its path.
  it("adds the env column when flows span two environments", () => {
    const out = renderListTable(
      [row({ env: "staging" }), row({ env: "debugging-beats" })],
      false,
    );
    expect(headerOf(out)).toContain("env");
    expect(out).toContain("staging");
    expect(out).toContain("debugging-beats");
  });

  it("leaves the cell blank for a flow outside any pulled environment", () => {
    const out = renderListTable(
      [
        row({ name: "Pulled", env: "staging" }),
        row({ name: "Other", env: "prod" }),
        row({ name: "Local", env: undefined }),
      ],
      false,
    );

    const header = headerOf(out);
    const envStart = header.indexOf("env");
    const envWidth = header.slice(envStart).indexOf("file");
    const localRow = out.split("\n").find((l) => l.startsWith("Local")) ?? "";
    // The cell must be empty, not some other environment's name.
    expect(localRow.slice(envStart, envStart + envWidth).trim()).toBe("");
  });

  it("places env between target and tags", () => {
    const out = renderListTable(
      [
        row({ env: "staging", tags: ["auth"] }),
        row({ env: "prod", tags: ["auth"] }),
      ],
      false,
    );
    const header = headerOf(out);
    expect(header.indexOf("env")).toBeGreaterThan(header.indexOf("target"));
    expect(header.indexOf("tags")).toBeGreaterThan(header.indexOf("env"));
  });

  // A project flow is its own source: without the column you cannot tell it
  // from a pulled row.
  it("adds the env column when local rows mix with one pulled environment", () => {
    const out = renderListTable(
      [row({ env: "staging" }), row({ env: undefined })],
      false,
    );
    expect(headerOf(out)).toContain("env");
  });
});
