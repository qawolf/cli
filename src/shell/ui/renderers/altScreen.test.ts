import { expect, it } from "bun:test";

import { openAltScreen } from "./altScreen.js";

function terminal(columns: number, rows: number) {
  const cells = Array.from({ length: rows }, () =>
    Array<string>(columns).fill(" "),
  );
  let x = 0;
  let y = 0;
  return {
    lines: () => cells.map((row) => row.join("")),
    write(chunk: string) {
      // A terminal keeps the cursor in its last column until another printable
      // character wraps it; erase commands act on that last column immediately.
      // oxlint-disable-next-line no-control-regex
      for (const token of chunk.match(/\x1b\[[\d;?]*[A-Za-z]|[^]/g) ?? []) {
        if (token === "\x1b[H") {
          x = 0;
          y = 0;
        } else if (token === "\x1b[K" || token === "\x1b[J") {
          cells[y]?.fill(" ", x);
          if (token === "\x1b[J")
            for (let row = y + 1; row < rows; row++) cells[row]?.fill(" ");
        } else if (token === "\r") x = 0;
        else if (token === "\n") y++;
        else if (!token.startsWith("\x1b")) {
          const row = cells[y];
          if (row) row[x] = token;
          x = Math.min(columns - 1, x + 1);
        }
      }
      return true;
    },
  };
}

it("keeps the final cell of rows that fill the terminal width", () => {
  const output = terminal(10, 2);
  const screen = openAltScreen(output);
  screen.paint("1234567890\nabcdefghij");
  expect(output.lines()).toEqual(["1234567890", "abcdefghij"]);
  screen.close();
});

it("clears stale cells and rows when the next frame gets smaller", () => {
  const output = terminal(10, 3);
  const screen = openAltScreen(output);
  screen.paint("1234567890\nabcdefghij\n0123456789");
  screen.paint("short\nx");
  expect(output.lines()).toEqual(["short     ", "x         ", "          "]);
  screen.close();
});
