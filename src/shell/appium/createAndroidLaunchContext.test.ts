import { join } from "node:path";
import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  makeCtx,
  makeDriver,
  makePool,
  testSlot,
} from "./createAndroidLaunchContext.fixtures.js";

afterEach(() => {
  mock.restore();
});

describe("launch()", () => {
  it("should check out a slot using the avdName option", async () => {
    const pool = makePool();
    const context = makeCtx({ emulatorPool: pool });
    await context.launch();
    expect(pool.checkOut).toHaveBeenCalledWith("test-avd");
  });

  it("should call createSession with the server port and slot serial", async () => {
    const createSession = mock(async () => makeDriver());
    const context = makeCtx({ createSession });
    await context.launch();
    expect(createSession).toHaveBeenCalledWith(4723, "emulator-5554");
  });

  it("should call adb to disable animations after session starts", async () => {
    const adb = mock(async (_args: string[]) => ({ stdout: "" }));
    const context = makeCtx({ adb });
    await context.launch();
    const allArgs = adb.mock.calls.map((call) => call[0]).flat();
    expect(allArgs).toContain("window_animation_scale");
    expect(allArgs).toContain("transition_animation_scale");
    expect(allArgs).toContain("animator_duration_scale");
    expect(allArgs).toContain("0.0");
  });

  it("should call adb to dismiss keyguard after session starts", async () => {
    const adb = mock(async (_args: string[]) => ({ stdout: "" }));
    const context = makeCtx({ adb });
    await context.launch();
    const allArgs = adb.mock.calls.map((call) => call[0]).flat();
    expect(allArgs).toContain("KEYCODE_WAKEUP");
    expect(allArgs).toContain("dismiss-keyguard");
  });

  it("should start screen recording when recordVideo is true", async () => {
    const startRecordingScreen = mock(async () => {});
    const driver = makeDriver({ startRecordingScreen });
    const context = makeCtx(
      { createSession: async () => driver },
      { recordVideo: true },
    );
    await context.launch();
    expect(startRecordingScreen).toHaveBeenCalledTimes(1);
  });

  it("should not start screen recording when recordVideo is false", async () => {
    const startRecordingScreen = mock(async () => {});
    const driver = makeDriver({ startRecordingScreen });
    const context = makeCtx({ createSession: async () => driver });
    await context.launch();
    expect(startRecordingScreen).not.toHaveBeenCalled();
  });

  it("should throw if launch is called twice", async () => {
    const context = makeCtx();
    await context.launch();
    let err: unknown;
    try {
      await context.launch();
    } catch (e) {
      err = e;
    }
    expect((err as Error).message).toBe(
      "launch() already called on this context",
    );
  });

  it("should check in the slot and rethrow if createSession throws", async () => {
    const pool = makePool();
    const createSession = mock(async () => {
      throw new Error("bad caps");
    });
    const context = makeCtx({ emulatorPool: pool, createSession });
    let caughtError: unknown;
    try {
      await context.launch();
    } catch (e) {
      caughtError = e;
    }
    expect((caughtError as Error).message).toBe("bad caps");
    expect(pool.checkIn).toHaveBeenCalledWith(testSlot);
  });

  it("should delete the Appium session and return the slot if configureEmulator throws", async () => {
    const deleteSession = mock(async () => {});
    const driver = makeDriver({ deleteSession });
    const pool = makePool();
    const adb = mock(async () => {
      throw new Error("adb offline");
    });
    const context = makeCtx({
      emulatorPool: pool,
      createSession: async () => driver,
      adb,
    });
    let err: unknown;
    try {
      await context.launch();
    } catch (e) {
      err = e;
    }
    expect((err as Error).message).toBe("adb offline");
    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect(pool.checkIn).toHaveBeenCalledWith(testSlot);
  });
});

describe("pages()", () => {
  it("should return empty array before launch", () => {
    expect(makeCtx().pages()).toEqual([]);
  });

  it("should return the driver after launch", async () => {
    const driver = makeDriver();
    const context = makeCtx({ createSession: async () => driver });
    await context.launch();
    expect(context.pages()).toEqual([driver]);
  });
});

describe("cleanup()", () => {
  it("should stop recording and return video path when recordVideo is true", async () => {
    const stopRecordingScreen = mock(async () =>
      Buffer.from("fake-mp4").toString("base64"),
    );
    const driver = makeDriver({ stopRecordingScreen });
    const writeFile = mock(async (_fp: string, _d: Buffer) => {});
    const context = makeCtx(
      { createSession: async () => driver, writeFile },
      { recordVideo: true, outputDir: "/tmp/vid" },
    );
    await context.launch();
    const result = await context.cleanup(true);
    expect(result.videoPaths).toHaveLength(1);
    expect(result.videoPaths[0]).toBe(join("/tmp/vid", "video.mp4"));
    expect(writeFile).toHaveBeenCalledWith(
      join("/tmp/vid", "video.mp4"),
      expect.any(Buffer),
    );
  });

  it("should return empty videoPaths when recordVideo is false", async () => {
    const context = makeCtx();
    await context.launch();
    expect((await context.cleanup(true)).videoPaths).toEqual([]);
  });

  it("should always return empty tracePaths", async () => {
    const context = makeCtx();
    await context.launch();
    expect((await context.cleanup(true)).tracePaths).toEqual([]);
  });

  it("should call deleteSession on the driver during cleanup", async () => {
    const deleteSession = mock(async () => {});
    const driver = makeDriver({ deleteSession });
    const context = makeCtx({ createSession: async () => driver });
    await context.launch();
    await context.cleanup(true);
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });

  it("should check in the emulator slot during cleanup", async () => {
    const pool = makePool();
    const context = makeCtx({ emulatorPool: pool });
    await context.launch();
    await context.cleanup(true);
    expect(pool.checkIn).toHaveBeenCalledWith(testSlot);
  });

  it("should be idempotent — second cleanup returns empty paths without re-running", async () => {
    const deleteSession = mock(async () => {});
    const driver = makeDriver({ deleteSession });
    const context = makeCtx({ createSession: async () => driver });
    await context.launch();
    await context.cleanup(true);
    const result2 = await context.cleanup(true);
    expect(result2).toEqual({ videoPaths: [], tracePaths: [] });
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });

  it("should check in the slot even if deleteSession throws", async () => {
    const deleteSession = mock(async () => {
      throw new Error("session gone");
    });
    const pool = makePool();
    const context = makeCtx({
      emulatorPool: pool,
      createSession: async () => makeDriver({ deleteSession }),
    });
    await context.launch();
    await context.cleanup(true); // must resolve, not throw
    expect(pool.checkIn).toHaveBeenCalledTimes(1);
  });

  it("should return empty paths from cleanup if launch was never called", async () => {
    expect(await makeCtx().cleanup(true)).toEqual({
      videoPaths: [],
      tracePaths: [],
    });
  });
});
