import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createHumanRenderers } from "./human.js";

describe("human renderers — withProgress", () => {
  afterEach(() => {
    mock.restore();
  });

  it("calls spinner.start on first step", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    await withProgress(
      [{ message: "first step", task: async () => undefined }],
      "done",
    );

    const s = clack.createdSpinners[0]!;
    expect(s.start).toHaveBeenCalledTimes(1);
    expect(s.start).toHaveBeenCalledWith("[1/1] first step");
    expect(s.message).not.toHaveBeenCalled();
  });

  it("calls spinner.message on subsequent steps", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    await withProgress(
      [
        { message: "first", task: async () => undefined },
        { message: "second", task: async () => undefined },
        { message: "third", task: async () => undefined },
      ],
      "done",
    );

    const s = clack.createdSpinners[0]!;
    expect(s.start).toHaveBeenCalledTimes(1);
    expect(s.message).toHaveBeenCalledTimes(2);
    expect(s.message).toHaveBeenNthCalledWith(1, "[2/3] second");
    expect(s.message).toHaveBeenNthCalledWith(2, "[3/3] third");
  });

  it("calls spinner.stop with static done string", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    await withProgress(
      [{ message: "step", task: async () => undefined }],
      "All done!",
    );

    const s = clack.createdSpinners[0]!;
    expect(s.stop).toHaveBeenCalledTimes(1);
    expect(s.stop).toHaveBeenCalledWith("All done!");
  });

  it("calls spinner.stop with done function result", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    const doneFn = mock(
      (results: unknown[]) => `Finished with ${String(results.length)} results`,
    );

    await withProgress(
      [
        { message: "step 1", task: async () => "a" },
        { message: "step 2", task: async () => "b" },
      ],
      doneFn,
    );

    const s = clack.createdSpinners[0]!;
    expect(doneFn).toHaveBeenCalledTimes(1);
    expect(doneFn).toHaveBeenCalledWith(["a", "b"]);
    expect(s.stop).toHaveBeenCalledWith("Finished with 2 results");
  });

  it("collects and returns results from all tasks", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    const results = await withProgress(
      [
        { message: "step 1", task: async () => 42 },
        { message: "step 2", task: async () => "hello" },
        { message: "step 3", task: async () => true },
      ],
      "done",
    );

    expect(results).toEqual([42, "hello", true]);
  });

  it("marks spinner as errored with the current step label when a task throws", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    let caughtError: unknown;
    try {
      await withProgress(
        [
          {
            message: "will fail",
            task: async () => {
              throw Error("task error");
            },
          },
        ],
        "done",
      );
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("task error");

    const s = clack.createdSpinners[0]!;
    expect(s.start).toHaveBeenCalledTimes(1);
    expect(s.error).toHaveBeenCalledTimes(1);
    expect(s.error).toHaveBeenCalledWith("[1/1] will fail");
    expect(s.stop).not.toHaveBeenCalled();
  });

  it("labels include step numbering", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    await withProgress(
      [
        { message: "fetch data", task: async () => undefined },
        { message: "process data", task: async () => undefined },
      ],
      "done",
    );

    const s = clack.createdSpinners[0]!;
    expect(s.start).toHaveBeenCalledWith("[1/2] fetch data");
    expect(s.message).toHaveBeenCalledWith("[2/2] process data");
  });
});

describe("human renderers — withProgress — verboseTarget", () => {
  afterEach(() => {
    mock.restore();
  });

  it("should use clack.log.step per step when verboseTarget is provided", async () => {
    const clack = makeClack();
    const verboseTarget: { write: ((msg: string) => void) | undefined } = {
      write: undefined,
    };
    const { withProgress } = createHumanRenderers(clack, verboseTarget);

    await withProgress(
      [
        { message: "Step 1", task: async () => undefined },
        { message: "Step 2", task: async () => undefined },
      ],
      "Done",
    );

    expect(clack.log.step).toHaveBeenNthCalledWith(1, "Step 1");
    expect(clack.log.step).toHaveBeenNthCalledWith(2, "Step 2");
    expect(clack.log.success).toHaveBeenCalledWith("Done");
    expect(clack.createdSpinners).toHaveLength(0);
    expect(clack.createdTaskLogs).toHaveLength(0);
  });

  it("should call clack.log.error with the failing step label when a step throws", async () => {
    const clack = makeClack();
    const verboseTarget: { write: ((msg: string) => void) | undefined } = {
      write: undefined,
    };
    const { withProgress } = createHumanRenderers(clack, verboseTarget);

    let caughtError: unknown;
    try {
      await withProgress(
        [
          {
            message: "Step 1",
            task: async () => {
              throw new Error("fail");
            },
          },
        ],
        "Done",
      );
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(clack.log.error).toHaveBeenCalledWith("Step 1");
  });

  it("should not set verboseTarget.write (output routes through clack.log directly)", async () => {
    const clack = makeClack();
    const verboseTarget: { write: ((msg: string) => void) | undefined } = {
      write: undefined,
    };
    const { withProgress } = createHumanRenderers(clack, verboseTarget);

    let writeWasSet = false;
    await withProgress(
      [
        {
          message: "Step 1",
          task: async () => {
            writeWasSet = verboseTarget.write !== undefined;
          },
        },
      ],
      "Done",
    );

    expect(writeWasSet).toBe(false);
    expect(verboseTarget.write).toBeUndefined();
  });

  it("should use spinner (not clack.log.step) when verboseTarget is absent", async () => {
    const clack = makeClack();
    const { withProgress } = createHumanRenderers(clack);

    await withProgress(
      [{ message: "Step 1", task: async () => undefined }],
      "Done",
    );

    expect(clack.createdSpinners).toHaveLength(1);
    expect(clack.createdTaskLogs).toHaveLength(0);
    expect(clack.log.step).not.toHaveBeenCalled();
  });
});
