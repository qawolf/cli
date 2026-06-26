import { describe, expect, it } from "bun:test";

import { formatErrorWithCause } from "./formatErrorWithCause.js";

describe("formatErrorWithCause", () => {
  it("returns just the error string when there is no cause", () => {
    expect(formatErrorWithCause(new Error("boom"))).toBe("Error: boom");
  });

  it("appends the cause Error's stack under a Caused by line", () => {
    const cause = new Error("inner");
    cause.stack = "Error: inner\n    at foo (/proj/src/a.ts:1:1)";
    const err = new Error("outer", { cause });

    const out = formatErrorWithCause(err);

    expect(out).toContain("Error: outer");
    expect(out).toContain("Caused by:");
    expect(out).toContain("at foo");
  });

  it("filters node_modules and dist/cli.js frames out of the cause stack", () => {
    const cause = new Error("inner");
    cause.stack =
      "Error: inner\n" +
      "    at keep (/proj/src/a.ts:1:1)\n" +
      "    at dep (/proj/node_modules/x/index.js:2:2)\n" +
      "    at boot (/proj/dist/cli.js:3:3)";
    const err = new Error("outer", { cause });

    const out = formatErrorWithCause(err);

    expect(out).toContain("at keep");
    expect(out).not.toContain("node_modules");
    expect(out).not.toContain("dist/cli.js");
  });

  it("renders an error-like object cause via its string message", () => {
    const err = new Error("outer", { cause: { message: "custom failure" } });

    expect(formatErrorWithCause(err)).toContain("Caused by: custom failure");
  });

  it("renders a primitive cause via String()", () => {
    const err = new Error("outer", { cause: "plain string cause" });

    expect(formatErrorWithCause(err)).toContain(
      "Caused by: plain string cause",
    );
  });

  it("walks a multi-level Error cause chain", () => {
    const root = new Error("root");
    const mid = new Error("mid", { cause: root });
    const top = new Error("top", { cause: mid });

    const out = formatErrorWithCause(top);

    expect(out).toContain("Error: top");
    expect(out).toContain("mid");
    expect(out).toContain("root");
    expect(out.match(/Caused by:/g)).toHaveLength(2);
  });

  it("stops the chain after a non-Error cause", () => {
    const swallowed = new Error("should not appear");
    const err = new Error("outer", {
      cause: { message: "object cause", cause: swallowed },
    });

    const out = formatErrorWithCause(err);

    expect(out).toContain("Caused by: object cause");
    expect(out).not.toContain("should not appear");
  });
});
