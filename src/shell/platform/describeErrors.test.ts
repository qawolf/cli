import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";
import {
  describeBundleDownloadError,
  describeIdentityError,
  describeRequestError,
  describeTeamStorageDownloadError,
} from "./describeErrors.js";

const baseUrl = "https://app.qawolf.com";
const reason = "Your API key has no access to this environment.";

const httpError = (status: number, body = "") =>
  ({ kind: "http", status, body }) as const;

const envelope = (message: string) =>
  JSON.stringify({ error: { json: { message } } });

describe("describeRequestError", () => {
  it.each([401, 403, 404, 500])(
    "carries the server's reason on HTTP %i",
    (status) => {
      const described = describeRequestError(
        httpError(status, envelope(reason)),
        baseUrl,
        "run.create",
      );

      expect(described.errorBody).toBe(reason);
      expect(described.error).toContain(String(status));
    },
  );

  it.each([401, 403, 404, 500])(
    "omits the body entirely when HTTP %i carries no reason",
    (status) => {
      const described = describeRequestError(
        httpError(status, "<html>gateway</html>"),
        baseUrl,
        "run.create",
      );

      expect("errorBody" in described).toBe(false);
    },
  );

  it("maps HTTP 401 to the auth exit code", () => {
    const described = describeRequestError(
      httpError(401),
      baseUrl,
      "run.create",
    );

    expect(described.exitCode).toBe(exitCodes.auth);
  });

  it.each([403, 404, 500])(
    "leaves the exit code unset on HTTP %i",
    (status) => {
      const described = describeRequestError(
        httpError(status),
        baseUrl,
        "run.create",
      );

      expect("exitCode" in described).toBe(false);
    },
  );

  it("omits the body for a network failure", () => {
    const described = describeRequestError(
      { kind: "network", cause: new Error("connection reset") },
      baseUrl,
    );

    expect("errorBody" in described).toBe(false);
    expect(described.error).toContain(baseUrl);
  });

  it("omits the body for a timeout", () => {
    const described = describeRequestError(
      { kind: "timeout", timeoutMs: 15_000 },
      baseUrl,
    );

    expect("errorBody" in described).toBe(false);
  });

  it("omits the body for an unparseable response", () => {
    const described = describeRequestError(
      { kind: "parse", cause: new Error("bad shape") },
      baseUrl,
    );

    expect("errorBody" in described).toBe(false);
  });
});

describe("describeIdentityError", () => {
  it("maps HTTP 401 to the auth exit code", () => {
    const described = describeIdentityError(httpError(401));

    expect(described.exitCode).toBe(exitCodes.auth);
  });

  it("leaves the exit code unset on HTTP 403", () => {
    const described = describeIdentityError(httpError(403));

    expect("exitCode" in described).toBe(false);
  });
});

// Signed-URL downloads use a stall timeout that resets while bytes arrive, so
// the message must describe a stall, not a whole-download deadline.
describe("describeBundleDownloadError", () => {
  it("describes a timeout as a stall", () => {
    const message = describeBundleDownloadError({
      kind: "timeout",
      timeoutMs: 30_000,
    });

    expect(message).toBe(
      "Downloading the flow bundle stalled — no data arrived for 30s. Please try again.",
    );
  });
});

describe("describeTeamStorageDownloadError", () => {
  it("describes a timeout as a stall", () => {
    const message = describeTeamStorageDownloadError("interview-video.y4m", {
      kind: "timeout",
      timeoutMs: 30_000,
    });

    expect(message).toBe(
      "Downloading the team-storage asset interview-video.y4m stalled — no data arrived for 30s. Please try again.",
    );
  });
});
