import { afterEach, describe, expect, it, vi } from "vitest";

import { createWithProgress } from "./withProgress.js";

type MockSpinner = {
  start: ReturnType<typeof vi.fn>;
  message: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function createMockSpinner(): MockSpinner {
  return {
    start: vi.fn(),
    message: vi.fn(),
    stop: vi.fn(),
    error: vi.fn(),
  };
}

function createMockClack(spinner: MockSpinner): {
  spinner: () => MockSpinner;
} {
  return { spinner: () => spinner };
}

describe("createWithProgress", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("human mode", () => {
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
        (results: unknown[]) =>
          `Finished with ${String(results.length)} results`,
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

    it("marks spinner as errored with the current step label when a task throws", async () => {
      const spinner = createMockSpinner();
      const clack = createMockClack(spinner);
      const withProgress = createWithProgress({
        mode: "human",
        clack: clack as never,
      });

      await expect(
        withProgress(
          [
            {
              message: "will fail",
              task: async () => {
                throw Error("task error");
              },
            },
          ],
          "done",
        ),
      ).rejects.toThrow("task error");

      expect(spinner.start).toHaveBeenCalledOnce();
      expect(spinner.error).toHaveBeenCalledOnce();
      expect(spinner.error).toHaveBeenCalledWith("(1/1) will fail");
      expect(spinner.stop).not.toHaveBeenCalled();
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

  describe("json mode", () => {
    it("writes parseable JSON step and success lines to stderr", async () => {
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const spinner = createMockSpinner();
      const clack = createMockClack(spinner);
      const withProgress = createWithProgress({
        mode: "json",
        clack: clack as never,
      });

      const results = await withProgress(
        [{ message: "verifying", task: async () => "ok" }],
        "done",
      );

      expect(results).toEqual(["ok"]);
      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "step", message: "verifying" }) + "\n",
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: "success", message: "done" }) + "\n",
      );
      expect(spinner.start).not.toHaveBeenCalled();
    });
  });

  describe("agent mode", () => {
    it("writes left-aligned progress to stderr", async () => {
      const stderrSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const spinner = createMockSpinner();
      const clack = createMockClack(spinner);
      const withProgress = createWithProgress({
        mode: "agent",
        clack: clack as never,
      });

      const results = await withProgress(
        [
          { message: "verifying", task: async () => "ok" },
          { message: "storing", task: async () => "saved" },
        ],
        "All done!",
      );

      expect(results).toEqual(["ok", "saved"]);
      expect(stderrSpy).toHaveBeenCalledWith("verifying\n");
      expect(stderrSpy).toHaveBeenCalledWith("storing\n");
      expect(stderrSpy).toHaveBeenCalledWith("All done!\n");
      expect(spinner.start).not.toHaveBeenCalled();
    });
  });
});
