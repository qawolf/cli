import { describe, expect, it, mock } from "bun:test";

import { selectRunByTag } from "./selectRunByTag.js";

const login = "/proj/.qawolf/staging/src/flows/login.flow.ts";
const smoke = "/proj/.qawolf/staging/src/flows/smoke.flow.ts";

const tagsFor = (
  entries: Record<string, readonly string[]>,
): ((files: readonly string[]) => Promise<Map<string, readonly string[]>>) =>
  mock(() => Promise.resolve(new Map(Object.entries(entries))));

const noMatch = (error: string) => ({ error, exitCode: 2 });
// The environment choice is the caller's concern; these tests pass the
// selection straight through.
const chooseEnv = (files: string[]) => Promise.resolve({ proceed: files });

describe("selectRunByTag", () => {
  it("returns every file when no tag is given", async () => {
    const result = await selectRunByTag({
      files: [login, smoke],
      selectors: { tags: [] },
      chooseEnv,
      readCachedTags: tagsFor({}),
      noMatch,
    });

    expect(result).toEqual({ ok: true, files: [login, smoke] });
  });

  it("keeps only the flows carrying a named tag", async () => {
    const result = await selectRunByTag({
      files: [login, smoke],
      selectors: { tags: ["auth"] },
      chooseEnv,
      readCachedTags: tagsFor({ [login]: ["auth"], [smoke]: ["smoke"] }),
      noMatch,
    });

    expect(result).toEqual({ ok: true, files: [login] });
  });

  // Nothing cached means the tags are unknown, so filtering would match
  // nothing and read as "no flow carries that tag".
  it("reports that tags are not cached when none are", async () => {
    const result = await selectRunByTag({
      files: [login],
      selectors: { tags: ["auth"] },
      chooseEnv,
      readCachedTags: tagsFor({}),
      noMatch,
    });

    expect(result).toMatchObject({ ok: false, result: { exitCode: 4 } });
  });

  it("hands an empty selection to the caller", async () => {
    const result = await selectRunByTag({
      files: [login],
      selectors: { tags: ["nope"] },
      chooseEnv,
      readCachedTags: tagsFor({ [login]: ["auth"] }),
      noMatch,
    });

    expect(result).toEqual({
      ok: false,
      result: { error: "No flows matched tags nope.", exitCode: 2 },
    });
  });

  it("lets the caller downgrade an empty selection", async () => {
    const result = await selectRunByTag({
      files: [login],
      selectors: { tags: ["nope"] },
      chooseEnv,
      readCachedTags: tagsFor({ [login]: ["auth"] }),
      noMatch: () => undefined,
    });

    expect(result).toEqual({ ok: false, result: undefined });
  });

  // The caller decides which environment a multi-environment match meant.
  it("returns whatever the environment choice resolved to", async () => {
    const result = await selectRunByTag({
      files: [login, smoke],
      selectors: { tags: ["auth"] },
      chooseEnv: () => Promise.resolve({ proceed: [smoke] }),
      readCachedTags: tagsFor({ [login]: ["auth"], [smoke]: ["auth"] }),
      noMatch,
    });

    expect(result).toEqual({ ok: true, files: [smoke] });
  });

  it("returns the caller's result when the choice stops the run", async () => {
    const result = await selectRunByTag({
      files: [login],
      selectors: { tags: ["auth"] },
      chooseEnv: () => Promise.resolve({ stop: undefined }),
      readCachedTags: tagsFor({ [login]: ["auth"] }),
      noMatch,
    });

    expect(result).toEqual({ ok: false, result: undefined });
  });
});
