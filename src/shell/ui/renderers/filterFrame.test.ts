import { describe, expect, it } from "bun:test";

import { type FilterFrame, renderFilterFrame } from "./filterFrame.js";

// oxlint-disable-next-line no-control-regex
const strip = (s: string): string => s.replace(/\x1b\[[\d;]*m/g, "");

const frame = (over: Partial<FilterFrame> = {}): FilterFrame => ({
  state: "active",
  message: "Filter flows",
  search: "exam",
  searchWithCursor: "exam█",
  header: "name        file",
  rowCount: 20,
  line: (index) => `flow ${String(index + 1)}`,
  focus: 0,
  marked: new Set(),
  markedCount: 0,
  detail: "id flow-1 · src/flows/1.flow.ts",
  notice: undefined,
  hints: "^Y copy path",
  columns: 100,
  // Leaves room for 4 rows once the frame's other lines are counted.
  terminalRows: 12,
  count: "20 of 100 flows",
  ...over,
});

const lines = (over: Partial<FilterFrame> = {}): string[] =>
  strip(renderFilterFrame(frame(over))).split("\n");

const rowsShown = (over: Partial<FilterFrame> = {}): string[] =>
  lines(over)
    .map((line) => /flow (\d+)\s*$/.exec(line)?.[1])
    .filter((n): n is string => n !== undefined);

describe("renderFilterFrame", () => {
  it("shows the search, an upper-case header over a rule, and the rows that fit", () => {
    const out = lines();
    expect(out).toContain("│  Search: exam█");
    expect(out).toContain("│  NAME        FILE");
    expect(out.some((line) => line.startsWith("│  ───"))).toBe(true);
    expect(rowsShown()).toEqual(["1", "2", "3", "4"]);
  });

  it("marks the highlighted row", () => {
    const out = lines({ focus: 2 });
    expect(out.find((line) => line.includes("flow 3"))).toStartWith("│› ");
    expect(out.find((line) => line.includes("flow 2"))).toStartWith("│  ");
  });

  it("moves the window only once the highlight would leave it", () => {
    expect(rowsShown({ focus: 3 })).toEqual(["1", "2", "3", "4"]);
    expect(rowsShown({ focus: 10 })).toEqual(["8", "9", "10", "11"]);
    expect(lines({ focus: 10 }).at(-2)).toContain("rows 8–11");
  });

  it("stops at the last row", () => {
    expect(rowsShown({ focus: 19 })).toEqual(["17", "18", "19", "20"]);
  });

  it("describes the highlighted row under the table", () => {
    expect(lines()).toContain("│  id flow-1 · src/flows/1.flow.ts");
  });

  it("shows a confirmation in place of the count while it lasts", () => {
    const footer = lines({
      notice: { tone: "success", text: "Copied src/flows/1.flow.ts" },
    }).at(-2);
    expect(footer).toContain("✓ Copied src/flows/1.flow.ts");
    expect(footer).not.toContain("20 of 100");
  });

  // "No flow id yet" is not a success; a green tick would say it was.
  it("marks a notice that is not a success with a warning sign", () => {
    const footer = lines({
      notice: { tone: "warning", text: "No flow id yet." },
    }).at(-2);
    expect(footer).toContain("▲ No flow id yet.");
    expect(footer).not.toContain("✓");
  });

  it("lists the action keys beside the navigation keys", () => {
    expect(lines().join("\n")).toContain("^Y copy path");
    expect(lines().at(-1)).toContain("Tab mark · ↑/↓ move");
  });

  // A frame taller than the screen scrolls the terminal.
  it("never draws more lines than the terminal has", () => {
    expect(lines().length).toBeLessThanOrEqual(12);
  });

  it("keeps every line within the width, the highlight bar included", () => {
    for (const line of lines({ columns: 40, focus: 1 })) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it.each([1, 2, 4, 8, 24])("fits within a terminal with %i rows", (height) => {
    expect(lines({ terminalRows: height }).length).toBeLessThanOrEqual(height);
  });

  it("clips long titles, searches, headers and Unicode rows by display columns", () => {
    const out = lines({
      columns: 40,
      message: "登录".repeat(30),
      searchWithCursor: "x".repeat(120),
      header: "name".repeat(30),
      rowCount: 1,
      line: () => "登录".repeat(25),
    });
    for (const line of out)
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(40);
  });

  it("keeps Enter and Esc instructions visible at 80 columns", () => {
    const out = lines({ columns: 80, hints: "^Y copy path · ^O copy id" }).join(
      "\n",
    );
    expect(out).toContain("Enter prints matches");
    expect(out).toContain("Esc cancels");
  });

  it("keeps multiline metadata and controls on single display lines", () => {
    const over = {
      message: "Filter\nflows",
      search: "with\npassword",
      searchWithCursor: "with\npassword█",
      header: "name\tfile",
      line: () => "Log in\nwith password\t!",
      detail: "src/flow\r\nname.flow.ts",
      count: "20\nflows",
      hints: "copy\bpath",
      terminalRows: 24,
    };
    const out = lines(over);
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out.join("\n")).toContain("Log in with password !");
    expect(out.join("\n")).toContain("Filter flows");
    expect(out.join("\n")).toContain("src/flow name.flow.ts");
    expect(out.join("\n")).not.toMatch(/[\t\r\b]/);
    expect(lines({ ...over, state: "submit" }).length).toBe(3);
    expect(over.search).toBe("with\npassword");
  });

  it("marks marked rows in the gutter, the highlighted one included", () => {
    const out = lines({ focus: 1, marked: new Set([1, 2]), markedCount: 2 });
    expect(out.find((line) => line.includes("flow 2"))).toStartWith("│◼ ");
    expect(out.find((line) => line.includes("flow 3"))).toStartWith("│◼ ");
    expect(out.find((line) => line.includes("flow 1"))).toStartWith("│  ");
  });

  // Marks can come from other searches, so the count includes hidden ones.
  it("counts the marked items, and says Enter prints them", () => {
    const footer = lines({
      marked: new Set([0]),
      markedCount: 3,
      columns: 140,
    }).at(-2);
    expect(footer).toContain("20 of 100 flows · 3 marked");
    expect(lines({ markedCount: 3 }).at(-1)).toContain("Enter prints marked");
  });

  it("says Enter prints the matches when nothing is marked", () => {
    expect(lines().at(-1)).toContain("Enter prints matches");
  });

  it("says when nothing matches", () => {
    expect(lines({ rowCount: 0, count: "0 of 100 flows" })).toContain(
      "│  Nothing matches.",
    );
  });

  // The kept rows are printed in full afterwards; a second table is noise.
  it("collapses to a summary once submitted", () => {
    const out = lines({ state: "submit" });
    expect(out.join("\n")).not.toContain("flow 1");
    expect(out.at(-1)).toContain("exam  20 of 100 flows");
    expect(out).toHaveLength(3);
  });

  it("collapses to the marked count when marked items were kept", () => {
    expect(lines({ state: "submit", markedCount: 3 }).at(-1)).toContain(
      "3 marked",
    );
  });

  it("collapses to the struck-out search when cancelled", () => {
    const out = lines({ state: "cancel" });
    expect(out.join("\n")).not.toContain("flow 1");
    expect(out.at(-1)).toContain("exam");
    expect(out).toHaveLength(3);
  });
});
