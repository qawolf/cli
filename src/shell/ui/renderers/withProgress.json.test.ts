import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createWithProgress } from "./withProgress.js";

describe("createWithProgress — json mode", () => {
  afterEach(() => {
    mock.restore();
  });

  it("writes parseable JSON step and success lines to stderr", async () => {
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
      () => true,
    );
    const clack = makeClack();
    const withProgress = createWithProgress({ mode: "json", clack });

    const results = await withProgress(
      [{ message: "verifying", task: async () => "ok" }],
      "done",
    );

    expect(results).toEqual(["ok"]);
    expect(stderrSpy).toHaveBeenCalledWith(
      JSON.stringify({
        type: "step",
        message: "verifying",
        step: 1,
        total: 1,
      }) + "\n",
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      JSON.stringify({ type: "success", message: "done" }) + "\n",
    );
    expect(clack.spinner).not.toHaveBeenCalled();
  });
});
