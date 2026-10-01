import { expect, it, mock } from "bun:test";

import { fakeTerminal, open, typed } from "./filterList.testUtils.js";
import type { FilterNotice } from "./types.js";

it("consumes Ctrl-Y before readline can yank killed search text", async () => {
  const run = mock(() =>
    Promise.resolve<FilterNotice>({ tone: "success", text: "copied" }),
  );
  const { input, result } = open(fakeTerminal(), [
    { key: "y", label: "copy", run },
  ]);
  await typed(input, "alpha");
  await typed(input, "\x15");
  await typed(input, "\x1b[B");
  await typed(input, "\x19");
  input.write("\r");
  const kept = await result;
  expect(run).toHaveBeenCalledWith(["beta"]);
  expect(kept).toEqual({ ok: true, value: ["alpha", "beta", "gamma"] });
});
