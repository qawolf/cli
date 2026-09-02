import { describe, expect, it } from "bun:test";

import { resolveEnvironment } from "./resolveEnvironment.js";
import { makeDeps } from "./resolveEnvironment.testUtils.js";

const opts = { explicit: undefined, requiredMessage: "req" };

describe("resolveEnvironment platform errors", () => {
  it("surfaces an environment.get failure with the alias caveat", async () => {
    const { deps } = makeDeps({ getError: "HTTP 400" });

    const outcome = await resolveEnvironment(deps, {
      ...opts,
      explicit: "staging",
    });

    expect(outcome).toEqual({
      kind: "error",
      error:
        "Could not resolve environment staging: HTTP 400 If staging is an alias, note that aliases require a team API key.",
      unreachable: false,
    });
  });

  it("carries the server's reason alongside the alias caveat", async () => {
    const { deps } = makeDeps({
      getError: "HTTP 404",
      getErrorBody: "No environment named staging exists on this team.",
    });

    const outcome = await resolveEnvironment(deps, {
      ...opts,
      explicit: "staging",
    });

    expect(outcome).toEqual({
      kind: "error",
      error:
        "Could not resolve environment staging: HTTP 404 If staging is an alias, note that aliases require a team API key.",
      errorBody: "No environment named staging exists on this team.",
      unreachable: false,
    });
  });

  // The unreachable flag is what lets `flows run --env` fall back to a pulled
  // copy: it must be set only when the platform never answered, so a
  // definitive refusal (404, revoked key) still surfaces as an error.
  it("marks the outcome unreachable when the platform never answered", async () => {
    const { deps } = makeDeps({
      getError: "Could not reach the platform.",
      getUnreachable: true,
    });

    const outcome = await resolveEnvironment(deps, {
      ...opts,
      explicit: "staging",
    });

    if (outcome.kind !== "error") throw new Error("expected an error");
    expect(outcome.unreachable).toBe(true);
  });

  it("surfaces a platform error", async () => {
    const { deps } = makeDeps({ findError: "HTTP 500" });

    const outcome = await resolveEnvironment(deps, opts);

    expect(outcome).toEqual({
      kind: "error",
      error: "HTTP 500",
      unreachable: false,
    });
  });

  it("carries the server's reason from the environment listing", async () => {
    const { deps } = makeDeps({
      findError: "HTTP 403",
      findErrorBody: "This API key has no access to environments.",
    });

    const outcome = await resolveEnvironment(deps, opts);

    expect(outcome).toEqual({
      kind: "error",
      error: "HTTP 403",
      errorBody: "This API key has no access to environments.",
      unreachable: false,
    });
  });
});
