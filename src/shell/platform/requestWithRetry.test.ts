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

  // The network kind covers a reset after the request body was sent as well as
  // a connection refused outright, so it cannot prove the request never arrived.
  it("says a request whose connection failed may have arrived", async () => {
    expect(
      await failWith({ cause: Error("ECONNRESET"), kind: "network" }),
    ).toEqual({
      error: "failed",
      mayHaveArrived: true,
      ok: false,
    });
  });
});
