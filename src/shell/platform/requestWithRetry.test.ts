import { describe, expect, it } from "bun:test";

import type { WireError } from "./createTrpcClient.js";
import { requestWithRetry } from "./requestWithRetry.js";

const noSleep = async (): Promise<void> => {};

function failWith(error: WireError) {
  return requestWithRetry({
    backoffMs: [],
    call: async () => ({ error, ok: false as const }),
    describe: () => ({ error: "failed" }),
    sleep: noSleep,
  });
}

describe("requestWithRetry", () => {
  // A reached deadline and an unreadable reply both leave the caller unable to
  // say whether the server acted; for a write that is the difference between
  // "retry the same id" and "that will fail the same way again".
  it("says a timed-out request may have arrived", async () => {
    expect(await failWith({ kind: "timeout", timeoutMs: 20 })).toEqual({
      error: "failed",
      mayHaveArrived: true,
      ok: false,
    });
  });

  it("says a request whose reply could not be read arrived", async () => {
    expect(await failWith({ cause: Error("bad json"), kind: "parse" })).toEqual(
      { error: "failed", mayHaveArrived: true, ok: false },
    );
  });

  it("does not say so when the server answered with a status", async () => {
    expect(await failWith({ body: "no", kind: "http", status: 400 })).toEqual({
      error: "failed",
      ok: false,
    });
  });

  it("does not say so when the connection failed", async () => {
    expect(
      await failWith({ cause: Error("ECONNREFUSED"), kind: "network" }),
    ).toEqual({
      error: "failed",
      ok: false,
    });
  });
});
