import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildHarContextOpts, harFlowPath, maybeCleanupHar } from "./har.js";

afterEach(() => {
  mock.restore();
});

describe("harFlowPath", () => {
  it("should return <outputDir>/har/<flowName>.har", () => {
    expect(harFlowPath("/out", "my-flow")).toBe("/out/har/my-flow.har");
  });
});

describe("buildHarContextOpts", () => {
  it("should return recordHar config with mode minimal and content omit when harContent is omit", () => {
    expect(buildHarContextOpts("/out/har/flow.har", "omit")).toEqual({
      recordHar: {
        path: "/out/har/flow.har",
        mode: "minimal",
        content: "omit",
      },
    });
  });

  it("should return recordHar config with mode minimal and content embed when harContent is full", () => {
    expect(buildHarContextOpts("/out/har/flow.har", "full")).toEqual({
      recordHar: {
        path: "/out/har/flow.har",
        mode: "minimal",
        content: "embed",
      },
    });
  });
});

describe("maybeCleanupHar", () => {
  it("should call unlink when harMode is retain-on-failure and flow passed", async () => {
    const unlinkMock = mock(async () => {});
    const fs = { unlink: unlinkMock };
    await maybeCleanupHar(fs, "/out/har/flow.har", true, "retain-on-failure");
    expect(unlinkMock).toHaveBeenCalledWith("/out/har/flow.har");
  });

  it("should not call unlink when harMode is retain-on-failure and flow failed", async () => {
    const unlinkMock = mock(async () => {});
    const fs = { unlink: unlinkMock };
    await maybeCleanupHar(fs, "/out/har/flow.har", false, "retain-on-failure");
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("should not call unlink when harMode is on", async () => {
    const unlinkMock = mock(async () => {});
    const fs = { unlink: unlinkMock };
    await maybeCleanupHar(fs, "/out/har/flow.har", true, "on");
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("should not call unlink when harMode is off", async () => {
    const unlinkMock = mock(async () => {});
    const fs = { unlink: unlinkMock };
    await maybeCleanupHar(fs, "/out/har/flow.har", true, "off");
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("should not throw when unlink rejects", async () => {
    const fs = {
      unlink: mock(async () => {
        throw new Error("ENOENT");
      }),
    };
    const result = maybeCleanupHar(
      fs,
      "/out/har/flow.har",
      true,
      "retain-on-failure",
    );
    expect(result).resolves.toBeUndefined();
  });
});
