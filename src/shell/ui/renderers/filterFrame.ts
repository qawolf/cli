import { S_BAR, S_BAR_END, symbol } from "@clack/prompts";

import { cyan, dim, inverse, strike } from "~/core/ansi.js";
import { clipColumns, displayWidth, padColumns } from "~/core/displayWidth.js";

import { singleLine } from "./singleLine.js";

export const frameGutter = `${S_BAR}  `;

export type FilterFrame = {
  readonly state: "initial" | "active" | "cancel" | "submit" | "error";
  readonly message: string;
  readonly search: string;
  readonly searchWithCursor: string;
  readonly header: string;
  readonly rowCount: number;
  readonly line: (index: number) => string;
  readonly focus: number;
  readonly detail: string | undefined;
  readonly columns: number;
  readonly terminalRows: number;
  readonly count: string;
};

function collapsed(frame: FilterFrame, title: string): string[] {
  const kept = `${frame.search === "" ? "" : `${frame.search}  `}${frame.count}`;
  const typed = frame.state === "submit" ? dim(kept) : strike(frame.search);
  return [S_BAR, title, `${frameGutter}${typed}`];
}

function rowGutter(focused: boolean): string {
  const sign = focused ? cyan("›") : " ";
  return `${S_BAR}${sign} `;
}

function keyHints(room: number): string {
  const enter = "Enter prints matches";
  const essential = `${enter} · Esc cancels`;
  const full = `↑/↓ move · ${essential}`;
  if (displayWidth(full) <= room) return full;
  return displayWidth(essential) <= room
    ? essential
    : "Enter print · Esc cancel";
}

export function renderFilterFrame(frame: FilterFrame): string {
  const columns = Math.max(0, frame.columns);
  const height = Math.max(1, frame.terminalRows);
  const room = Math.max(0, columns - displayWidth(frameGutter));
  const title = `${symbol(frame.state)}  ${frame.message}`;
  const fit = (lines: readonly string[]): string =>
    lines
      .slice(-height)
      .map((line) => clipColumns(singleLine(line), columns))
      .join("\n");
  if (frame.state === "submit" || frame.state === "cancel")
    return fit(collapsed(frame, title));

  const full = height >= 10;
  const headings = height >= 6;
  const before = [
    ...(full ? [S_BAR] : []),
    ...(headings ? [title] : []),
    ...(height > 1
      ? [
          `${frameGutter}Search: ${clipColumns(singleLine(frame.searchWithCursor), Math.max(0, room - 8), true)}`,
        ]
      : []),
    ...(headings && frame.rowCount > 0
      ? [`${frameGutter}${dim(frame.header.toUpperCase())}`]
      : []),
    ...(full && frame.rowCount > 0
      ? [`${frameGutter}${dim("─".repeat(room))}`]
      : []),
  ];
  const detail =
    full && frame.rowCount > 0 && frame.detail !== undefined
      ? [`${frameGutter}${dim(frame.detail)}`]
      : [];
  const visible = Math.max(
    0,
    height - before.length - detail.length - (headings ? 2 : 1),
  );
  const start = Math.min(
    Math.max(0, frame.focus - visible + 1),
    Math.max(0, frame.rowCount - visible),
  );
  const count = Math.min(visible, frame.rowCount - start);
  const shown = Array.from({ length: count }, (_, index) => {
    const at = start + index;
    const line = clipColumns(singleLine(frame.line(at)), room);
    const focused = at === frame.focus;
    return `${rowGutter(focused)}${focused ? inverse(padColumns(line, room)) : line}`;
  });
  if (frame.rowCount === 0 && visible > 0)
    shown.push(`${frameGutter}${dim("Nothing matches.")}`);

  const position =
    frame.rowCount > visible && count > 0
      ? ` · rows ${String(start + 1)}–${String(start + count)}`
      : "";
  const statusLine = `${frameGutter}${dim(`${frame.count}${position}`)}`;
  return fit([
    ...before,
    ...shown,
    ...detail,
    ...(headings ? [statusLine] : []),
    `${S_BAR_END}  ${dim(keyHints(room))}`,
  ]);
}
