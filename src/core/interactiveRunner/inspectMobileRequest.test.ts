import { describe, expect, it } from "bun:test";

import { buildInspectMobileRequest } from "./inspectMobileRequest.js";

const noFlags = {
  by: undefined,
  context: undefined,
  partial: undefined,
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

  it("turns whole-pixel x/y strings into a point request", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        by: "point",
        x: "100",
        y: "200",
      }),
    ).toEqual({
      ok: true,
      request: { by: "point", what: "elements", x: 100, y: 200 },
    });
  });

  it("carries text and partial into a text request", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        by: "text",
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
      buildInspectMobileRequest("elements", {
        ...noFlags,
        by: "text",
        text: "Log in",
      }),
    ).toEqual({
      ok: true,
      request: { by: "text", text: "Log in", what: "elements" },
    });
  });

  it("refuses a point request missing y", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        by: "point",
        x: "100",
      }).ok,
    ).toBe(false);
  });

  // Blank reads as NaN rather than pixel 0, so the schema refuses it by name
  // rather than silently landing on the top-left corner.
  it("reads a blank x as NaN rather than pixel 0, and refuses it", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        by: "point",
        x: "",
        y: "200",
      }).ok,
    ).toBe(false);
  });

  it("refuses a fractional pixel", () => {
    expect(
      buildInspectMobileRequest("elements", {
        ...noFlags,
        by: "point",
        x: "100.5",
        y: "200",
      }).ok,
    ).toBe(false);
  });

  it("refuses a text request with no text to match", () => {
    expect(
      buildInspectMobileRequest("elements", { ...noFlags, by: "text" }).ok,
    ).toBe(false);
  });

  it("refuses an elements request naming neither point nor text", () => {
    expect(buildInspectMobileRequest("elements", noFlags).ok).toBe(false);
  });

  it("refuses an unrecognized what", () => {
    expect(buildInspectMobileRequest("bogus", noFlags).ok).toBe(false);
  });
});
