import { describe, expect, it } from "bun:test";
import { extractFlowMeta } from "./flowMeta.js";

// A flow name is an arbitrary string typed by a human, so it can contain either
// quote character. The parser must track which delimiter opened the literal and
// honour backslash escapes, rather than stopping at the first quote it sees.
describe("extractFlowMeta — quotes in the flow name", () => {
  it("should keep an apostrophe inside a double-quoted name", () => {
    expect(
      extractFlowMeta(`flow("Shopper's cart", "Web - Chrome", async () => {})`),
    ).toEqual({ name: "Shopper's cart", target: "Web - Chrome" });
  });

  it("should keep a double quote inside a single-quoted name", () => {
    expect(
      extractFlowMeta(`flow('Say "hi"', 'Web - Chrome', async () => {})`),
    ).toEqual({ name: 'Say "hi"', target: "Web - Chrome" });
  });

  it("should decode an escaped double quote inside a double-quoted name", () => {
    expect(
      extractFlowMeta(
        String.raw`flow("Say \"hi\"", "Web - Chrome", async () => {})`,
      ),
    ).toEqual({ name: 'Say "hi"', target: "Web - Chrome" });
  });

  it("should decode an escaped apostrophe inside a single-quoted name", () => {
    expect(
      extractFlowMeta(
        String.raw`flow('Shopper\'s cart', 'Web - Chrome', async () => {})`,
      ),
    ).toEqual({ name: "Shopper's cart", target: "Web - Chrome" });
  });

  it("should decode an escaped backslash inside a name", () => {
    expect(
      extractFlowMeta(
        String.raw`flow("C:\\Users share", "Web - Chrome", async () => {})`,
      ),
    ).toEqual({ name: String.raw`C:\Users share`, target: "Web - Chrome" });
  });

  // A backslash before a line break is a line continuation: it lets the source
  // span lines and contributes nothing to the value.
  it("should drop a line continuation inside a name", () => {
    expect(extractFlowMeta('flow("Say \\\nhi", "Web - Chrome", x)')).toEqual({
      name: "Say hi",
      target: "Web - Chrome",
    });
  });

  it("should drop a CRLF line continuation inside a name", () => {
    expect(extractFlowMeta('flow("Say \\\r\nhi", "Web - Chrome", x)')).toEqual({
      name: "Say hi",
      target: "Web - Chrome",
    });
  });

  it.each([
    ["U+2028 line separator", "\u2028"],
    ["U+2029 paragraph separator", "\u2029"],
  ])("should drop a %s line continuation inside a name", (_label, sep) => {
    expect(
      extractFlowMeta(`flow("Say \\${sep}hi", "Web - Chrome", x)`),
    ).toEqual({ name: "Say hi", target: "Web - Chrome" });
  });

  // Unlike a raw line feed, a raw U+2028 or U+2029 is legal inside a quoted
  // literal from ES2019 on, so it belongs in the value rather than ending it.
  it.each([
    ["U+2028", "\u2028"],
    ["U+2029", "\u2029"],
  ])("should keep an unescaped %s inside a name", (_label, sep) => {
    expect(extractFlowMeta(`flow("Say${sep}hi", "Web - Chrome", x)`)).toEqual({
      name: `Say${sep}hi`,
      target: "Web - Chrome",
    });
  });

  // Only identity escapes are decoded. Names do not carry control or unicode
  // escapes, because the generator avoids escaping altogether by choosing a
  // delimiter the name does not contain.
  it("should not decode a control-character escape inside a name", () => {
    expect(
      extractFlowMeta(String.raw`flow("A\tB", "Web - Chrome", async () => {})`),
    ).toEqual({ name: "AtB", target: "Web - Chrome" });
  });
});

describe("extractFlowMeta — template literal names", () => {
  it("should read a backtick-delimited name", () => {
    expect(
      extractFlowMeta('flow(`My Flow`, "Web - Chrome", async () => {})'),
    ).toEqual({ name: "My Flow", target: "Web - Chrome" });
  });

  it("should keep both quote characters inside a backtick-delimited name", () => {
    expect(
      extractFlowMeta(
        'flow(`Shopper\'s "best" cart`, "Web - Chrome", async () => {})',
      ),
    ).toEqual({ name: `Shopper's "best" cart`, target: "Web - Chrome" });
  });

  it("should treat an interpolated template literal as a dynamic name", () => {
    expect(
      extractFlowMeta('flow(`Flow ${n}`, "Web - Chrome", async () => {})'),
    ).toEqual({ name: undefined, target: undefined });
  });
});

// Characterization: these pin behaviour the current regexes already have, so a
// reimplementation cannot quietly drop it.
describe("extractFlowMeta — callee matching", () => {
  it.each([
    ["flow(", `flow("N", "chromium", x)`],
    ["member expression", `obj.flow("N", "chromium", x)`],
    ["space before paren", `flow  (  "N" ,  "chromium" , x)`],
  ])("should match %s", (_label, source) => {
    expect(extractFlowMeta(source)).toEqual({
      name: "N",
      target: "chromium",
    });
  });

  it.each([
    ["workflow(", `workflow("N", "chromium", x)`],
    ["myflow(", `myflow("N", "chromium", x)`],
    ["_flow(", `_flow("N", "chromium", x)`],
    // `$` and non-ASCII letters are valid in a JS identifier but are not \w,
    // so a \b-based test reads these as a bare `flow(` call.
    ["$flow(", `$flow("N", "chromium", x)`],
    ["πflow(", `πflow("N", "chromium", x)`],
    // A private method named `flow` is not the `flow()` helper.
    ["this.#flow(", `this.#flow("N", "chromium", x)`],
  ])("should not match %s", (_label, source) => {
    expect(extractFlowMeta(source)).toEqual({
      name: undefined,
      target: undefined,
    });
  });
});

describe("extractFlowMeta — degenerate and dynamic arguments", () => {
  it("should report an empty name as undefined so callers fall back to the filename", () => {
    expect(extractFlowMeta(`flow("", "chromium", x)`)).toEqual({
      name: undefined,
      target: "chromium",
    });
  });

  it("should preserve a whitespace-only name verbatim", () => {
    expect(extractFlowMeta(`flow("   ", "chromium", x)`)).toEqual({
      name: "   ",
      target: "chromium",
    });
  });

  it("should return no target when the target is a variable", () => {
    expect(extractFlowMeta(`flow("N", myTarget, x)`)).toEqual({
      name: "N",
      target: undefined,
    });
  });

  it("should return nothing when the name is a variable", () => {
    expect(extractFlowMeta(`flow(myName, "chromium", x)`)).toEqual({
      name: undefined,
      target: undefined,
    });
  });
});

describe("extractFlowMeta — target in the options object", () => {
  it.each([
    ["bare key", `flow("N", { target: "chromium" }, x)`],
    ["key after another", `flow("N", { launch: true, target: "chromium" }, x)`],
    ["camelCase decoy", `flow("N", { myTarget: "no", target: "chromium" }, x)`],
    [
      "snake_case decoy",
      `flow("N", { my_target: "no", target: "chromium" }, x)`,
    ],
    [
      "decoy inside a string value",
      `flow("N", { note: "target: no", target: "chromium" }, x)`,
    ],
  ])("should read the target from %s", (_label, source) => {
    expect(extractFlowMeta(source)).toEqual({
      name: "N",
      target: "chromium",
    });
  });

  it("should not read a target from an object outside the flow() call", () => {
    expect(
      extractFlowMeta(
        `const opts = { target: "production" }; flow("My Flow", async () => {})`,
      ),
    ).toEqual({ name: "My Flow", target: undefined });
  });
});

describe("extractFlowMeta — multiple flow() calls", () => {
  it("should skip a flow( occurrence that is not followed by a name literal", () => {
    expect(
      extractFlowMeta(`// see flow(\nflow("Real", "chromium", x)`),
    ).toEqual({ name: "Real", target: "chromium" });
  });

  it("should read a commented-out flow() call, which it cannot distinguish from code", () => {
    expect(
      extractFlowMeta(
        `// flow("Commented", "firefox", x)\nflow("Real", "x", x)`,
      ),
    ).toEqual({ name: "Commented", target: "firefox" });
  });

  it("should take the name and target from the first call that supplies each", () => {
    expect(extractFlowMeta(`flow("A", x)\nflow("B", "chromium", x)`)).toEqual({
      name: "A",
      target: "chromium",
    });
  });
});
