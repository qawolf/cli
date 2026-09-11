import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeClack } from "~/shell/ui/clack/styledClack.mock.js";
import { createHumanRenderers } from "./human.js";

afterEach(() => {
  mock.restore();
});

const linesOf = (clack: ReturnType<typeof makeClack>): string[] =>
  clack.log.message.mock.calls[0]?.[0] as string[];

describe("human transcript", () => {
  it("frames a message with the headline first and every body line under the rail", () => {
    const clack = makeClack();
    createHumanRenderers(clack).transcript({
      body: "One.\nTwo.",
      data: {},
      headline: "QA Wolf  12:00:00",
    });

    expect(linesOf(clack)).toEqual(["QA Wolf  12:00:00", "One.", "Two."]);
  });

  it("wraps a long paragraph so no line escapes the rail", () => {
    const clack = makeClack();
    const long = Array.from({ length: 60 }, () => "word").join(" ");
    createHumanRenderers(clack).transcript({
      body: long,
      data: {},
      headline: "QA Wolf",
    });

    const [, ...body] = linesOf(clack);
    expect(body.length).toBeGreaterThan(1);
    expect(body.every((line) => line.length <= 100)).toBe(true);
    expect(body.join(" ")).toBe(long);
  });

  it("wraps at a readable width when the terminal reports none at all", () => {
    const original = Object.getOwnPropertyDescriptor(process.stdout, "columns");
    Object.defineProperty(process.stdout, "columns", {
      configurable: true,
      value: 0,
    });
    try {
      const clack = makeClack();
      createHumanRenderers(clack).transcript({
        body: Array.from({ length: 12 }, () => "word").join(" "),
        data: {},
        headline: "QA Wolf",
      });

      const [, ...body] = linesOf(clack);
      expect(body).toHaveLength(1);
    } finally {
      if (original) Object.defineProperty(process.stdout, "columns", original);
      else Reflect.deleteProperty(process.stdout, "columns");
    }
  });
});
