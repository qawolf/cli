import { describe, expect, it } from "bun:test";

import {
  type BrowserActionFlags,
  buildBrowserAction,
  parseBrowserAction,
} from "./browserAction.js";

const noFlags: BrowserActionFlags = {
  button: undefined,
  keys: undefined,
  path: undefined,
  scrollX: undefined,
  scrollY: undefined,
  text: undefined,
  url: undefined,
  x: undefined,
  y: undefined,
};

function build(type: string, flags: Partial<BrowserActionFlags> = {}) {
  return buildBrowserAction(type, { ...noFlags, ...flags });
}

describe("buildBrowserAction", () => {
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

  // The schema is strict, so a scroll carries both deltas or neither. Nothing in
  // the help says so, which is exactly why the refusal has to.
  it("refuses a scroll missing one of its two deltas", () => {
    const built = build("scroll", { scrollY: "300", x: "1", y: "2" });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("scroll_x");
  });
});

describe("parseBrowserAction", () => {
  it("takes a complete action as a model emitted it", () => {
    const parsed = parseBrowserAction({
      button: "left",
      type: "click",
      x: 1,
      y: 2,
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.action).toEqual({
      button: "left",
      type: "click",
      x: 1,
      y: 2,
    });
  });

  it("refuses one the published schema does not admit", () => {
    expect(parseBrowserAction({ type: "click" }).ok).toBe(false);
  });
});
