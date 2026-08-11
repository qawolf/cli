import { describe, expect, it } from "bun:test";

import {
  describeBundleDownloadError,
  describeTeamStorageDownloadError,
} from "./describeErrors.js";

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
