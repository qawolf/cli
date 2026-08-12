import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createHumanRenderers } from "./human.js";

describe("human renderers — withProgress task progress updates", () => {
  afterEach(() => {
    mock.restore();
  });

  it("updates the spinner label when a task reports progress", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    await withProgress(
      [
        {
          message: "Downloading assets",
          task: async (update) => {
            update("Downloading assets (1/3)");
            update("Downloading assets (2/3)");
          },
        },
      ],
      "done",
    );

    const s = clack.createdSpinners[0]!;
    expect(s.message).toHaveBeenNthCalledWith(
      1,
      "[1/1] Downloading assets (1/3)",
    );
    expect(s.message).toHaveBeenNthCalledWith(
      2,
      "[1/1] Downloading assets (2/3)",
    );
  });

  it("reports the latest progress label when a task fails", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    let caughtError: unknown;
    try {
      await withProgress(
        [
          {
            message: "Downloading assets",
            task: async (update) => {
              update("Downloading assets (2/3)");
              throw new Error("download failed");
            },
          },
        ],
        "done",
      );
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    const s = clack.createdSpinners[0]!;
    expect(s.error).toHaveBeenCalledWith("[1/1] Downloading assets (2/3)");
  });

  it("logs task progress updates as steps when verboseTarget is provided", async () => {
    const clack = makeClack();
    const verboseTarget: { write: ((msg: string) => void) | undefined } = {
      write: undefined,
    };
    const { withProgress } = createHumanRenderers(clack, verboseTarget);

    await withProgress(
      [
        {
          message: "Downloading assets",
          task: async (update) => {
            update("Downloading assets (1/2)");
          },
        },
      ],
      "Done",
    );

    expect(clack.log.step).toHaveBeenNthCalledWith(
      2,
      "[1/1] Downloading assets (1/2)",
    );
  });
});
