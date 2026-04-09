import { describe, expect, it, vi } from "vitest";

import { createWithProgress } from "./withProgress.js";

type MockSpinner = {
  start: ReturnType<typeof vi.fn>;
  message: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

function createMockSpinner(): MockSpinner {
  return {
    start: vi.fn(),
    message: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockClack(spinner: MockSpinner): {
  spinner: () => MockSpinner;
} {
  return { spinner: () => spinner };
}

describe("createWithProgress", () => {
  it("throws in non-human mode", async () => {
    const spinner = createMockSpinner();
    const clack = createMockClack(spinner);
    const withProgress = createWithProgress({
      mode: "json",
      clack: clack as never,
    });

    await expect(
      withProgress([{ message: "step", task: async () => "result" }], "done"),
    ).rejects.toThrow("ctx.withProgress() requires human mode (current: json)");
  });

  it("calls spinner.start on first step", async () => {
    const spinner = createMockSpinner();
    const clack = createMockClack(spinner);
    const withProgress = createWithProgress({
      mode: "human",
      clack: clack as never,
    });

    await withProgress(
      [{ message: "first step", task: async () => undefined }],
      "done",
    );

    expect(spinner.start).toHaveBeenCalledOnce();
    expect(spinner.start).toHaveBeenCalledWith("(1/1) first step");
    expect(spinner.message).not.toHaveBeenCalled();
  });

  it("calls spinner.message on subsequent steps", async () => {
    const spinner = createMockSpinner();
    const clack = createMockClack(spinner);
    const withProgress = createWithProgress({
      mode: "human",
      clack: clack as never,
    });

    await withProgress(
      [
        { message: "first", task: async () => undefined },
        { message: "second", task: async () => undefined },
        { message: "third", task: async () => undefined },
      ],
      "done",
    );

    expect(spinner.start).toHaveBeenCalledOnce();
    expect(spinner.message).toHaveBeenCalledTimes(2);
    expect(spinner.message).toHaveBeenNthCalledWith(1, "(2/3) second");
    expect(spinner.message).toHaveBeenNthCalledWith(2, "(3/3) third");
  });

  it("calls spinner.stop with static done string", async () => {
    const spinner = createMockSpinner();
    const clack = createMockClack(spinner);
    const withProgress = createWithProgress({
      mode: "human",
      clack: clack as never,
    });

    await withProgress(
      [{ message: "step", task: async () => undefined }],
      "All done!",
    );

    expect(spinner.stop).toHaveBeenCalledOnce();
    expect(spinner.stop).toHaveBeenCalledWith("All done!");
  });

  it("calls spinner.stop with done function result", async () => {
    const spinner = createMockSpinner();
    const clack = createMockClack(spinner);
    const withProgress = createWithProgress({
      mode: "human",
      clack: clack as never,
    });

    const doneFn = vi.fn(
      (results: unknown[]) => `Finished with ${String(results.length)} results`,
    );

    await withProgress(
      [
        { message: "step 1", task: async () => "a" },
        { message: "step 2", task: async () => "b" },
      ],
      doneFn,
    );

    expect(doneFn).toHaveBeenCalledOnce();
    expect(doneFn).toHaveBeenCalledWith(["a", "b"]);
    expect(spinner.stop).toHaveBeenCalledWith("Finished with 2 results");
  });

  it("collects and returns results from all tasks", async () => {
    const spinner = createMockSpinner();
    const clack = createMockClack(spinner);
    const withProgress = createWithProgress({
      mode: "human",
      clack: clack as never,
    });

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

  it("labels include step numbering", async () => {
    const spinner = createMockSpinner();
    const clack = createMockClack(spinner);
    const withProgress = createWithProgress({
      mode: "human",
      clack: clack as never,
    });

    await withProgress(
      [
        { message: "fetch data", task: async () => undefined },
        { message: "process data", task: async () => undefined },
      ],
      "done",
    );

    expect(spinner.start).toHaveBeenCalledWith("(1/2) fetch data");
    expect(spinner.message).toHaveBeenCalledWith("(2/2) process data");
  });
});
