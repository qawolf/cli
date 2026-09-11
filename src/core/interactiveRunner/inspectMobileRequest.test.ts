import { describe, expect, it } from "bun:test";

import { buildInspectMobileRequest } from "./inspectMobileRequest.js";

const noFlags = {
  context: undefined,
  partial: undefined,
  selector: undefined,
  strategy: undefined,
  text: undefined,
  x: undefined,
  y: undefined,
};

describe("buildInspectMobileRequest", () => {
  it("asks for the session with no other flags", () => {
    expect(buildInspectMobileRequest("session", noFlags)).toEqual({
      ok: true,
      request: { what: "session" },
    });
  });

  it("asks for the contexts with no other flags", () => {
    expect(buildInspectMobileRequest("contexts", noFlags)).toEqual({
      ok: true,
      request: { what: "contexts" },
    });
  });

  it("asks for the current context's page source when none is named", () => {
    expect(buildInspectMobileRequest("page", noFlags)).toEqual({
      ok: true,
      request: { what: "page" },
    });
  });

  it("carries a named context into a page request", () => {
    expect(
      buildInspectMobileRequest("page", { ...noFlags, context: "WEBVIEW_1" }),
    ).toEqual({
      ok: true,
      request: { context: "WEBVIEW_1", what: "page" },
    });
  });

  it("turns whole-pixel x/y strings into a point request from --x/--y alone", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        x: "100",
        y: "200",
      }),
    ).toEqual({
      ok: true,
      request: { by: "point", what: "elements", x: 100, y: 200 },
    });
  });

  it("carries text and partial into a text request from --text alone", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        partial: true,
        text: "Log in",
      }),
    ).toEqual({
      ok: true,
      request: { by: "text", partial: true, text: "Log in", what: "elements" },
    });
  });

  it("omits partial from a text request when it was not given", () => {
    expect(
      buildInspectMobileRequest("elements", { ...noFlags, text: "Log in" }),
    ).toEqual({
      ok: true,
      request: { by: "text", text: "Log in", what: "elements" },
    });
  });

  it("turns --selector alone into a selector request, defaulting the strategy", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        selector: "//button",
      }),
    ).toEqual({
      ok: true,
      request: {
        by: "selector",
        selector: "//button",
        strategy: "xpath",
        what: "elements",
      },
    });
  });

  it("carries --strategy alongside --selector", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        selector: "@label == 'Sign in'",
        strategy: "ios-predicate",
      }),
    ).toEqual({
      ok: true,
      request: {
        by: "selector",
        selector: "@label == 'Sign in'",
        strategy: "ios-predicate",
        what: "elements",
      },
    });
  });

  it("refuses a point request missing y", () => {
    expect(
      buildInspectMobileRequest("elements", { ...noFlags, x: "100" }).ok,
    ).toBe(false);
  });

  // Blank reads as NaN rather than pixel 0, so the schema refuses it by name
  // rather than silently landing on the top-left corner.
  it("reads a blank x as NaN rather than pixel 0, and refuses it", () => {
    expect(
      buildInspectMobileRequest("elements", { ...noFlags, x: "", y: "200" }).ok,
    ).toBe(false);
  });

  it("refuses a fractional pixel", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        x: "100.5",
        y: "200",
      }).ok,
    ).toBe(false);
  });

  it("refuses --strategy without --selector", () => {
    expect(
      buildInspectMobileRequest("elements", { ...noFlags, strategy: "xpath" })
        .ok,
    ).toBe(false);
  });

  it("refuses an empty --selector", () => {
    expect(
      buildInspectMobileRequest("elements", { ...noFlags, selector: "" }).ok,
    ).toBe(false);
  });

  it("refuses an elements request naming neither a point, text, nor a selector", () => {
    expect(buildInspectMobileRequest("elements", noFlags).ok).toBe(false);
  });

  it("refuses an unrecognized what", () => {
    expect(buildInspectMobileRequest("bogus", noFlags).ok).toBe(false);
  });

  // The schema strips fields the chosen `by` does not define rather than
  // refusing them, so `--x/--y --text ...` would otherwise answer the point
  // and silently ignore the text — the flags have to be refused before they
  // reach the schema, not dropped there.
  it("refuses --text alongside --x/--y rather than silently ignoring it", () => {
    const built = buildInspectMobileRequest("elements", {
      ...noFlags,
      text: "Sign in",
      x: "100",
      y: "200",
    });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("--x/--y");
    expect(built.error).toContain("--text/--partial");
  });

  it("refuses --partial alongside --x/--y", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        partial: true,
        x: "100",
        y: "200",
      }).ok,
    ).toBe(false);
  });

  it("refuses --selector alongside --x/--y", () => {
    const built = buildInspectMobileRequest("elements", {
      ...noFlags,
      selector: "//button",
      x: "100",
      y: "200",
    });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("--selector/--strategy");
  });

  it("refuses --selector alongside --text", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        selector: "//button",
        text: "Sign in",
      }).ok,
    ).toBe(false);
  });
});
