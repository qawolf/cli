import { afterEach, describe, expect, it, mock } from "bun:test";
import { initTrace, maybeCleanupTrace, traceFlowPath } from "./contextSetup.js";

afterEach(() => {
  mock.restore();
});

describe("traceFlowPath", () => {
  it("should return <outputDir>/trace/<flowName>.zip", () => {
    expect(traceFlowPath("/out", "my-flow")).toBe("/out/trace/my-flow.zip");
  });
});

describe("initTrace", () => {
  it("should return traceMode off and tracePath undefined when trace is off", async () => {
    const mkdirMock = mock(async () => {});
    const fs = { mkdir: mkdirMock };
    const result = await initTrace(fs, { outputDir: "/out" }, "flow");
    expect(result.traceMode).toBe("off");
    expect(result.tracePath).toBeUndefined();
    expect(mkdirMock).not.toHaveBeenCalled();
  });

  it("should return traceMode and tracePath and call mkdir when trace is on", async () => {
    const mkdirMock = mock(async () => {});
    const fs = { mkdir: mkdirMock };
    const result = await initTrace(
      fs,
      { trace: "on", outputDir: "/out" },
      "my-flow",
    );
    expect(result.traceMode).toBe("on");
    expect(result.tracePath).toBe("/out/trace/my-flow.zip");
    expect(mkdirMock).toHaveBeenCalledWith("/out/trace", { recursive: true });
  });

  it("should return traceMode and tracePath and call mkdir when trace is retain-on-failure", async () => {
    const mkdirMock = mock(async () => {});
    const fs = { mkdir: mkdirMock };
    const result = await initTrace(
      fs,
      { trace: "retain-on-failure", outputDir: "/out" },
      "my-flow",
    );
    expect(result.traceMode).toBe("retain-on-failure");
    expect(result.tracePath).toBe("/out/trace/my-flow.zip");
    expect(mkdirMock).toHaveBeenCalledWith("/out/trace", { recursive: true });
  });
});

describe("maybeCleanupTrace", () => {
  it("should call unlink when traceMode is retain-on-failure and flow passed", async () => {
    const unlinkMock = mock(async () => {});
    const fs = { unlink: unlinkMock };
    await maybeCleanupTrace(
      fs,
      "/out/trace/flow.zip",
      true,
      "retain-on-failure",
    );
    expect(unlinkMock).toHaveBeenCalledWith("/out/trace/flow.zip");
  });

  it("should not call unlink when traceMode is retain-on-failure and flow failed", async () => {
    const unlinkMock = mock(async () => {});
    const fs = { unlink: unlinkMock };
    await maybeCleanupTrace(
      fs,
      "/out/trace/flow.zip",
      false,
      "retain-on-failure",
    );
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("should not call unlink when traceMode is on", async () => {
    const unlinkMock = mock(async () => {});
    const fs = { unlink: unlinkMock };
    await maybeCleanupTrace(fs, "/out/trace/flow.zip", true, "on");
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("should not throw when unlink rejects", async () => {
    const fs = {
      unlink: mock(async () => {
        throw new Error("ENOENT");
      }),
    };
    const result = maybeCleanupTrace(
      fs,
      "/out/trace/flow.zip",
      true,
      "retain-on-failure",
    );
    expect(result).resolves.toBeUndefined();
  });

  it("should warn with the trace path when unlink rejects", async () => {
    const warn = mock((_msg: string) => {});
    const fs = {
      unlink: mock(async () => {
        throw new Error("EPERM");
      }),
    };
    await maybeCleanupTrace(
      fs,
      "/out/trace/flow.zip",
      true,
      "retain-on-failure",
      warn,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("/out/trace/flow.zip");
  });
});
