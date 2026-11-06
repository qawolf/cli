import { describe, expect, it } from "bun:test";

import {
  type ActionFlags,
  buildRunnerAction,
  parseRunnerAction,
} from "./browserAction.js";

const noFlags: ActionFlags = {
  button: undefined,
  durationMs: undefined,
  from: undefined,
  keys: undefined,
  path: undefined,
  scrollX: undefined,
  scrollY: undefined,
  selector: undefined,
  strategy: undefined,
  text: undefined,
  to: undefined,
  url: undefined,
  x: undefined,
  y: undefined,
};

function build(type: string, flags: Partial<ActionFlags> = {}) {
  return buildRunnerAction(type, { ...noFlags, ...flags });
}

describe("buildRunnerAction", () => {
  it("keeps the model's own spelling of the action names", () => {
    const built = build("double_click", { x: "10", y: "20" });

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.action.type).toBe("double_click");
  });

  it("keeps the model's own field names, snake_case and all", () => {
    const built = build("scroll", {
      scrollX: "0",
      scrollY: "300",
      x: "5",
      y: "6",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.action).toEqual({
      scroll_x: 0,
      scroll_y: 300,
      type: "scroll",
      x: 5,
      y: 6,
    });
  });

  it("reads a drag path as JSON points", () => {
    const built = build("drag", { path: '[{"x":10,"y":20},{"x":80,"y":90}]' });

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.action).toEqual({
      path: [
        { x: 10, y: 20 },
        { x: 80, y: 90 },
      ],
      type: "drag",
    });
  });

  it("says what --path should look like when it is not JSON", () => {
    const built = build("drag", { path: "10,20 80,90" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("JSON array of points");
  });

  it("clicks with the left button when no --button is given", () => {
    expect(build("click", { x: "480", y: "260" })).toEqual({
      action: { button: "left", type: "click", x: 480, y: 260 },
      ok: true,
    });
  });

  it("refuses --button on an action that has no button", () => {
    const built = build("move", { button: "left", x: "1", y: "2" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("button");
  });

  // Left out rather than passed as undefined, so the strict schema refuses a flag
  // that does not belong to the chosen action instead of dropping it.
  it("refuses a flag the chosen action does not have", () => {
    const built = build("click", { text: "hi", x: "1", y: "2" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("text");
  });

  it("names the actions it knows when given one it does not", () => {
    const built = build("hover", { x: "1", y: "2" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("double_click");
  });

  it("refuses a coordinate that is not a number", () => {
    const built = build("click", { button: "left", x: "left-ish", y: "2" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("NaN");
  });

  // Number("") is 0, so an unset shell variable would otherwise click the
  // top-left pixel instead of being answered.
  it.each([
    ["empty", ""],
    ["whitespace", "   "],
  ])("refuses an %s coordinate rather than reading it as 0", (_name, value) => {
    const built = build("click", { button: "left", x: value, y: "2" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("NaN");
  });

  it("refuses a blank scroll delta rather than reading it as 0", () => {
    const built = build("scroll", {
      scrollX: "0",
      scrollY: "",
      x: "1",
      y: "2",
    });

    expect(built.ok).toBe(false);
  });

  it("scrolls 0 in the direction a scroll leaves out", () => {
    expect(build("scroll", { scrollY: "300", x: "1", y: "2" })).toEqual({
      action: { scroll_x: 0, scroll_y: 300, type: "scroll", x: 1, y: 2 },
      ok: true,
    });
    expect(build("scroll", { scrollX: "-40", x: "1", y: "2" })).toEqual({
      action: { scroll_x: -40, scroll_y: 0, type: "scroll", x: 1, y: 2 },
      ok: true,
    });
    expect(build("scroll", { x: "1", y: "2" })).toEqual({
      action: { scroll_x: 0, scroll_y: 0, type: "scroll", x: 1, y: 2 },
      ok: true,
    });
  });

  it("refuses a scroll with no point to scroll at", () => {
    const built = build("scroll", { scrollY: "300" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("at x");
  });
});

describe("buildRunnerAction, mobile", () => {
  it("taps a point, or the element a selector names", () => {
    expect(build("tap", { x: "540", y: "1200" })).toEqual({
      action: { type: "tap", x: 540, y: 1200 },
      ok: true,
    });
    expect(
      build("tap", { selector: 'name == "Add"', strategy: "ios-predicate" }),
    ).toEqual({
      action: {
        selector: 'name == "Add"',
        strategy: "ios-predicate",
        type: "tap",
      },
      ok: true,
    });
  });

  it("refuses a tap aimed at both a point and an element", () => {
    const built = build("tap", { selector: "//a", x: "1", y: "2" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("not both");
  });

  it("reads a swipe's --from and --to as x,y points", () => {
    expect(
      build("swipe", { durationMs: "1500", from: "540,1600", to: "540,600" }),
    ).toEqual({
      action: {
        duration_ms: 1500,
        from: { x: 540, y: 1600 },
        to: { x: 540, y: 600 },
        type: "swipe",
      },
      ok: true,
    });
  });

  it.each(["540", "540,1600,2", ""])(
    "says what --from should look like when given %p",
    (from) => {
      const built = build("swipe", { from, to: "540,600" });

      expect(built.ok).toBe(false);
      if (built.ok) return;
      expect(built.error).toContain("x,y");
    },
  );

  it.each(["94107", ""])(
    "fills the field a selector names with %p, where empty clears it",
    (text) => {
      expect(
        build("fill", { selector: "//android.widget.EditText", text }),
      ).toEqual({
        action: { selector: "//android.widget.EditText", text, type: "fill" },
        ok: true,
      });
    },
  );

  it("refuses a selector on a browser action", () => {
    const built = build("type", { selector: "//input", text: "hi" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("selector");
  });
});

describe("parseRunnerAction", () => {
  it("takes a touchscreen action as well as a browser one", () => {
    expect(parseRunnerAction({ type: "tap", x: 1, y: 2 }).ok).toBe(true);
    expect(
      parseRunnerAction({ button: "left", type: "click", x: 1, y: 2 }).ok,
    ).toBe(true);
  });
});
