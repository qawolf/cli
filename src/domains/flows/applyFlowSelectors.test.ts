import { describe, expect, it, mock } from "bun:test";

import { applyFlowSelectors } from "./applyFlowSelectors.js";
import type { TagResolution } from "./resolveTags.js";

const cwd = "/proj";
const login = "/proj/src/flows/checkout/login.flow.ts";
const invoice = "/proj/src/flows/billing/invoice.flow.ts";

const liveTags = (): TagResolution => ({
  kind: "live",
  byPath: new Map([["src/flows/checkout/login.flow.ts", ["auth"]]]),
});

function makeArgs(
  over: Partial<Parameters<typeof applyFlowSelectors>[0]> = {},
) {
  return {
    files: [login, invoice],
    cwd,
    selectors: { tags: [] },
    warn: mock(() => undefined),
    resolveTags: undefined,
    fetchKnownTags: mock(() => Promise.resolve(["auth", "smoke"])),
    onEmpty: (error: string) => ({ error, exitCode: 2 }),
    ...over,
  };
}

describe("applyFlowSelectors without selectors", () => {
  it("passes every file through and resolves no tags", async () => {
    const resolveTags = mock(() => Promise.resolve(liveTags()));
    const result = await applyFlowSelectors(makeArgs({ resolveTags }));

    expect(result).toEqual({ ok: true, files: [login, invoice] });
    expect(resolveTags).not.toHaveBeenCalled();
  });
});

describe("applyFlowSelectors with a tag selector", () => {
  it("filters using the resolved tags", async () => {
    const result = await applyFlowSelectors(
      makeArgs({
        selectors: { tags: ["auth"] },
        resolveTags: mock(() => Promise.resolve(liveTags())),
      }),
    );

    expect(result).toEqual({ ok: true, files: [login] });
  });

  it("warns when it had to fall back to cached tags", async () => {
    const warn = mock((_message: string) => undefined);
    const cached: TagResolution = {
      kind: "cached",
      byPath: new Map([["src/flows/checkout/login.flow.ts", ["auth"]]]),
      fetchedAt: "2026-05-01T12:00:00.000Z",
    };

    const result = await applyFlowSelectors(
      makeArgs({
        selectors: { tags: ["auth"] },
        resolveTags: mock(() => Promise.resolve(cached)),
        warn,
      }),
    );

    expect(result).toEqual({ ok: true, files: [login] });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("cached");
  });

  it("fails when tags are neither live nor cached", async () => {
    const result = await applyFlowSelectors(
      makeArgs({
        selectors: { tags: ["auth"] },
        resolveTags: mock(() =>
          Promise.resolve({ kind: "unavailable" } as TagResolution),
        ),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      result: { exitCode: 4 },
    });
  });
});

describe("applyFlowSelectors when nothing matches", () => {
  it("checks the team tag list to tell a typo from an empty tag", async () => {
    const fetchKnownTags = mock(() => Promise.resolve(["auth", "smoke"]));
    const result = await applyFlowSelectors(
      makeArgs({
        selectors: { tags: ["aut"] },
        resolveTags: mock(() => Promise.resolve(liveTags())),
        fetchKnownTags,
      }),
    );

    expect(fetchKnownTags).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      result: {
        error: "No tag named 'aut' on this team. Did you mean 'auth'?",
        exitCode: 2,
      },
    });
  });
});

describe("applyFlowSelectors empty-selection result", () => {
  // `flows run` funnels every zero-flow outcome through noMatchResult so
  // --allow-no-match downgrades it; the caller owns that decision, not us.
  it("hands the message to the caller rather than fixing an exit code", async () => {
    const onEmpty = mock((error: string) => ({ error, exitCode: 99 }));

    const result = await applyFlowSelectors(
      makeArgs({
        selectors: { tags: ["auth"] },
        resolveTags: mock(() =>
          Promise.resolve({
            kind: "live",
            byPath: new Map([["src/flows/other.flow.ts", ["auth"]]]),
          } as TagResolution),
        ),
        fetchKnownTags: mock(() => Promise.resolve(["auth"])),
        onEmpty,
      }),
    );

    expect(onEmpty).toHaveBeenCalledWith("No flows matched tags auth.");
    expect(result).toEqual({
      ok: false,
      result: { error: "No flows matched tags auth.", exitCode: 99 },
    });
  });

  it("lets the caller downgrade an empty selection to a clean exit", async () => {
    const result = await applyFlowSelectors(
      makeArgs({
        selectors: { tags: ["auth"] },
        resolveTags: mock(() =>
          Promise.resolve({ kind: "live", byPath: new Map() } as TagResolution),
        ),
        fetchKnownTags: mock(() => Promise.resolve(["auth"])),
        onEmpty: () => undefined,
      }),
    );

    expect(result).toEqual({ ok: false, result: undefined });
  });
});
