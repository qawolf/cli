import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { makeClack } from "~/lib/ui/clack/styledClack.mock.js";
import { createWithProgress } from "./withProgress.js";

describe("createWithProgress — agent mode", () => {
  afterEach(() => {
    mock.restore();
  });

  it("writes left-aligned progress to stderr", async () => {
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
      () => true,
    );
    const clack = makeClack();
    const withProgress = createWithProgress({ mode: "agent", clack });

    const results = await withProgress(
      [
        { message: "verifying", task: async () => "ok" },
        { message: "storing", task: async () => "saved" },
      ],
      "All done!",
    );

    expect(results).toEqual(["ok", "saved"]);
    expect(stderrSpy).toHaveBeenCalledWith("[1/2] verifying\n");
    expect(stderrSpy).toHaveBeenCalledWith("[2/2] storing\n");
    expect(stderrSpy).toHaveBeenCalledWith("All done!\n");
    expect(clack.spinner).not.toHaveBeenCalled();
  });
});
