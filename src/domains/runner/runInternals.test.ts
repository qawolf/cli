import { InvalidArgumentError } from "commander";
import { afterEach, describe, expect, it, mock } from "bun:test";
import type { Logger } from "~/shell/logger.js";
import {
  dispatchFlow,
  type FlowsRunDeps,
  type WebResolvedFlow,
} from "./runInternals.js";
import { makeDeps, passResult, failResult } from "./run.fixtures.js";

import { parseEnum, parseInteger } from "./runFlagParsers.js";

afterEach(() => {
  mock.restore();
});

function makeLogger(): Logger {
  return {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
    trace: mock(() => {}),
  };
}

function makeDispatchDeps(logger?: Logger): FlowsRunDeps {
  const base = makeDeps({ runResults: [passResult()] });
  return logger !== undefined ? { ...base, logger } : base;
}

const webFlow: WebResolvedFlow = {
  kind: "web",
  file: "/proj/my-flow.ts",
  name: "my-flow",
  browser: "chromium",
};

describe("dispatchFlow logger", () => {
  it("should call logger.info with flow name before dispatch", async () => {
    const logger = makeLogger();
    const deps = makeDispatchDeps(logger);
    await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    expect(logger.info).toHaveBeenCalledWith(`run: ${webFlow.name}`);
  });

  it("should call logger.info with pass result after dispatch", async () => {
    const logger = makeLogger();
    const deps = makeDispatchDeps(logger);
    await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    const calls = (logger.info as ReturnType<typeof mock>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(
      calls.some((m) => /^pass: my-flow \(\d+ms, 1 attempt\)$/.test(m)),
    ).toBe(true);
  });

  it("should call logger.info with fail result after dispatch", async () => {
    const logger = makeLogger();
    const deps: FlowsRunDeps = {
      ...makeDeps({ runResults: [failResult()] }),
      logger,
    };
    await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    const calls = (logger.info as ReturnType<typeof mock>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(
      calls.some((m) => /^fail: my-flow \(\d+ms, 1 attempt\)$/.test(m)),
    ).toBe(true);
  });

  it("should not throw when logger dep is absent", async () => {
    const deps = makeDispatchDeps();
    const result = await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    expect(result.run.passed).toBe(true);
  });
});

describe("parseInteger", () => {
  it("returns the integer for a plain decimal string", () => {
    expect(parseInteger("--retries")("3")).toBe(3);
    expect(parseInteger("--retries")("0")).toBe(0);
  });

  it.each(["abc", "1.5", "", "+3", "03", "1e3", "-0"])(
    "rejects non-integer input %p",
    (value) => {
      expect(() => parseInteger("--retries")(value)).toThrow(
        InvalidArgumentError,
      );
    },
  );

  it("rejects values below the configured min", () => {
    expect(() => parseInteger("--retries", { min: 0 })("-1")).toThrow(
      /--retries must be >= 0/,
    );
    expect(() => parseInteger("--workers", { min: 1 })("0")).toThrow(
      /--workers must be >= 1/,
    );
  });

  it("accepts negatives when no min is provided", () => {
    expect(parseInteger("--retries")("-5")).toBe(-5);
  });
});

describe("parseEnum", () => {
  const modes = ["on", "off", "retain-on-failure"] as const;

  it.each([["on"], ["off"], ["retain-on-failure"]] as const)(
    "returns %p when value matches a known mode",
    (value) => {
      expect(parseEnum("--video", modes)(value)).toBe(value);
    },
  );

  it("rejects unknown values with the allowed list", () => {
    expect(() => parseEnum("--video", modes)("maybe")).toThrow(
      /--video must be one of: on, off, retain-on-failure/,
    );
  });
});
