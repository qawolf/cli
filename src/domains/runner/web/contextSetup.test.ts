import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  buildContextSetup,
  buildHarContextOpts,
  harFlowPath,
  initHar,
  maybeCleanupHar,
} from "./contextSetup.js";

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

describe("initHar", () => {
  it("should return harMode off and harPath undefined when har is off", async () => {
    const mkdirMock = mock(async () => {});
    const fs = { mkdir: mkdirMock };
    const result = await initHar(fs, { outputDir: "/out" }, "flow");
    expect(result.harMode).toBe("off");
    expect(result.harPath).toBeUndefined();
    expect(mkdirMock).not.toHaveBeenCalled();
  });

  it("should return harMode and harPath and call mkdir when har is on", async () => {
    const mkdirMock = mock(async () => {});
    const fs = { mkdir: mkdirMock };
    const result = await initHar(
      fs,
      { har: "on", outputDir: "/out" },
      "my-flow",
    );
    expect(result.harMode).toBe("on");
    expect(result.harPath).toBe("/out/har/my-flow.har");
    expect(mkdirMock).toHaveBeenCalledWith("/out/har", { recursive: true });
  });

  it("should return harMode and harPath and call mkdir when har is retain-on-failure", async () => {
    const mkdirMock = mock(async () => {});
    const fs = { mkdir: mkdirMock };
    const result = await initHar(
      fs,
      { har: "retain-on-failure", outputDir: "/out" },
      "my-flow",
    );
    expect(result.harMode).toBe("retain-on-failure");
    expect(result.harPath).toBe("/out/har/my-flow.har");
    expect(mkdirMock).toHaveBeenCalledWith("/out/har", { recursive: true });
  });
});

describe("buildContextSetup", () => {
  it("should return viewport, screen, and locale without recordVideo when video is off and no harPath", () => {
    const result = buildContextSetup(
      { width: 1280, height: 720 },
      { video: "off", outputDir: "/out" },
      undefined,
    );
    expect(result).toEqual({
      viewport: { width: 1280, height: 720 },
      screen: { width: 1280, height: 720 },
      locale: "en-US",
    });
  });

  it("should include recordVideo when video is on", () => {
    const result = buildContextSetup(
      { width: 1280, height: 720 },
      { video: "on", outputDir: "/out" },
      undefined,
    );
    expect(result).toEqual({
      viewport: { width: 1280, height: 720 },
      screen: { width: 1280, height: 720 },
      locale: "en-US",
      recordVideo: {
        dir: "/out/videos",
        size: { width: 1280, height: 720 },
      },
    });
  });

  it("should include recordHar when harPath is defined", () => {
    const result = buildContextSetup(
      { width: 1280, height: 720 },
      { video: "off", outputDir: "/out", harContent: "omit" },
      "/out/har/flow.har",
    );
    expect(result).toEqual({
      viewport: { width: 1280, height: 720 },
      screen: { width: 1280, height: 720 },
      locale: "en-US",
      recordHar: {
        path: "/out/har/flow.har",
        mode: "minimal",
        content: "omit",
      },
    });
  });

  it("should include both recordVideo and recordHar when video is on and harPath is defined", () => {
    const result = buildContextSetup(
      { width: 1280, height: 720 },
      { video: "on", outputDir: "/out", harContent: "omit" },
      "/out/har/flow.har",
    );
    expect(result).toEqual({
      viewport: { width: 1280, height: 720 },
      screen: { width: 1280, height: 720 },
      locale: "en-US",
      recordVideo: {
        dir: "/out/videos",
        size: { width: 1280, height: 720 },
      },
      recordHar: {
        path: "/out/har/flow.har",
        mode: "minimal",
        content: "omit",
      },
    });
  });
});
