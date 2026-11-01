import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { handlePublicApiCommand } from "./handle.js";
import { changesSpec, ctxWith } from "./handle.testUtils.js";

afterEach(() => {
  mock.restore();
});

describe("handlePublicApiCommand JSON flags", () => {
  it("parses a JSON flag value before calling the platform", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { ok: true },
    });
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );
    const spec = changesSpec();

    const result = await handlePublicApiCommand(ctx, spec, {
      changes: '{"items":[{"kind":"commit","title":"Fix the cart total"}]}',
    });

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(spec.contract, {
      changes: { items: [{ kind: "commit", title: "Fix the cart total" }] },
    });
  });

  it("rejects a JSON flag value that is not valid JSON", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, changesSpec(), {
      changes: "{items: []}",
    });

    expect(result?.error).toBe(
      "Invalid --changes value: expected a JSON value.",
    );
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("validates a parsed JSON flag value against the contract", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const ctx = ctxWith(
      makeFakeUI(),
      makeMockPlatformClient({ callPublicApi }),
    );

    const result = await handlePublicApiCommand(ctx, changesSpec(), {
      changes: '{"items":[{"kind":"tag","title":"v1.2.0"}]}',
    });

    expect(result?.error).toContain("changes.items[0].kind");
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
