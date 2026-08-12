import { describe, expect, it } from "bun:test";

import { parseErrorBody } from "./parseErrorBody.js";

const notAFlowFile =
  "src/flows/checkout.flow.ts is not a flow file. A run's entry point must be a flow file under src/flows.";

describe("parseErrorBody", () => {
  it("reads the message from a tRPC error envelope", () => {
    const body = JSON.stringify({
      error: {
        json: {
          code: -32603,
          data: {
            code: "BAD_REQUEST",
            httpStatus: 400,
            path: "public.runner.runFlow",
            message: notAFlowFile,
          },
          message: notAFlowFile,
        },
      },
    });

    expect(parseErrorBody(body)).toBe(notAFlowFile);
  });

  it("reads the message from an envelope without the superjson layer", () => {
    const body = JSON.stringify({ error: { message: "Runner is not ready." } });

    expect(parseErrorBody(body)).toBe("Runner is not ready.");
  });

  it("reads the flat legacy shape", () => {
    const body = JSON.stringify({ error: "API key is not valid." });

    expect(parseErrorBody(body)).toBe("API key is not valid.");
  });

  it("returns an empty string for a non-JSON body", () => {
    expect(parseErrorBody("<html><body>502 Bad Gateway</body></html>")).toBe(
      "",
    );
  });

  it("returns an empty string for an empty body", () => {
    expect(parseErrorBody("")).toBe("");
  });

  it("returns an empty string when the envelope carries no message", () => {
    const body = JSON.stringify({ error: { json: { code: -32603 } } });

    expect(parseErrorBody(body)).toBe("");
  });

  it("returns an empty string when the message is not a string", () => {
    const body = JSON.stringify({ error: { json: { message: { a: 1 } } } });

    expect(parseErrorBody(body)).toBe("");
  });

  it("returns an empty string for a JSON body that is not an object", () => {
    expect(parseErrorBody('"boom"')).toBe("");
    expect(parseErrorBody("[1,2,3]")).toBe("");
    expect(parseErrorBody("null")).toBe("");
  });

  it("returns an empty string when the message is only whitespace", () => {
    expect(parseErrorBody(JSON.stringify({ error: "   " }))).toBe("");
  });

  it("clips an oversized message", () => {
    const body = JSON.stringify({
      error: { json: { message: "x".repeat(5000) } },
    });

    const parsed = parseErrorBody(body);
    expect(parsed).toHaveLength(1024);
    expect(parsed.endsWith("…")).toBe(true);
  });

  it("clips to a caller-supplied limit, counting the ellipsis", () => {
    const body = JSON.stringify({ error: "abcdefghij" });

    expect(parseErrorBody(body, 4)).toBe("abc…");
  });

  it("leaves a message that exactly fills the limit alone", () => {
    const body = JSON.stringify({ error: "abcd" });

    expect(parseErrorBody(body, 4)).toBe("abcd");
  });

  it("returns just the ellipsis when the limit leaves room for nothing else", () => {
    const body = JSON.stringify({ error: "abcdefghij" });

    expect(parseErrorBody(body, 1)).toBe("…");
  });

  it.each([0, -5])("returns an empty string for a limit of %i", (maxLength) => {
    const body = JSON.stringify({ error: "abcdefghij" });

    expect(parseErrorBody(body, maxLength)).toBe("");
  });
});
