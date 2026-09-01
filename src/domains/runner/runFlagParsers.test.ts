import { InvalidArgumentError } from "commander";
import { describe, expect, it } from "bun:test";

import { collectValue, parseEnum, parseInteger } from "./runFlagParsers.js";

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

describe("collectValue", () => {
  // Repeatable rather than variadic, so a positional argument after the flag
  // is never mistaken for another value.
  it("accumulates repeated values in order", () => {
    let acc: string[] = [];
    acc = collectValue("auth", acc);
    acc = collectValue("smoke", acc);
    expect(acc).toEqual(["auth", "smoke"]);
  });

  it("does not mutate the previous list", () => {
    const first = ["auth"];
    const second = collectValue("smoke", first);
    expect(first).toEqual(["auth"]);
    expect(second).toEqual(["auth", "smoke"]);
  });
});
