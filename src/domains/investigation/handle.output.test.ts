import { describe, expect, it } from "bun:test";

import { makeCtx } from "~/shell/commandContext.testUtils.js";
import {
  outputInvestigationInspection,
  type InspectOptions,
} from "./handle.js";

const options: InspectOptions = {
  attemptId: "attempt-1",
  format: "html",
  limit: "20",
  snapshotId: "snapshot-1",
  type: "snapshot",
};

describe("investigation inspection output", () => {
  it("returns sanitized HTML document bytes inline when no file is requested", async () => {
    const ctx = makeCtx("json");
    const html =
      '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'">safe';

    await outputInvestigationInspection(ctx, options, {
      binary: {
        bytesBase64: Buffer.from(html).toString("base64"),
        extension: "html",
      },
      status: "available",
    });

    expect(ctx.ui.output).toHaveBeenCalledWith(
      { html, status: "available" },
      html,
    );
  });
});
