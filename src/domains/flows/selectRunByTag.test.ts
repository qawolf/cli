import { describe, expect, it, mock } from "bun:test";

import { selectRunByTag } from "./selectRunByTag.js";

const login = "/proj/.qawolf/staging/src/flows/login.flow.ts";
const smoke = "/proj/.qawolf/staging/src/flows/smoke.flow.ts";

const tagsFor = (
  entries: Record<string, readonly string[]>,
): ((files: readonly string[]) => Promise<Map<string, readonly string[]>>) =>
  mock(() => Promise.resolve(new Map(Object.entries(entries))));

const noMatch = (error: string) => ({ error, exitCode: 2 });

describe("selectRunByTag", () => {
  it("returns every file when no tag is given", async () => {
    const result = await selectRunByTag({
      files: [login, smoke],
      selectors: { tags: [] },
      readCachedTags: tagsFor({}),
      noMatch,
    });

    expect(result).toEqual([login, smoke]);
  });

  it("keeps only the flows carrying a named tag", async () => {
    const result = await selectRunByTag({
      files: [login, smoke],
      selectors: { tags: ["auth"] },
      readCachedTags: tagsFor({ [login]: ["auth"], [smoke]: ["smoke"] }),
      noMatch,
    });

    expect(result).toEqual([login]);
  });

  // Nothing cached means the tags are unknown, so filtering would match
  // nothing and read as "no flow carries that tag".
  it("reports that tags are not cached when none are", async () => {
    const result = await selectRunByTag({
      files: [login],
      selectors: { tags: ["auth"] },
      readCachedTags: tagsFor({}),
      noMatch,
    });

    expect(result).toMatchObject({ exitCode: 4 });
  });

  it("hands an empty selection to the caller", async () => {
    const result = await selectRunByTag({
      files: [login],
      selectors: { tags: ["nope"] },
      readCachedTags: tagsFor({ [login]: ["auth"] }),
      noMatch,
    });

    expect(result).toEqual({
      error: "No flows matched tags nope.",
      exitCode: 2,
    });
  });

  it("lets the caller downgrade an empty selection", async () => {
    const result = await selectRunByTag({
      files: [login],
      selectors: { tags: ["nope"] },
      readCachedTags: tagsFor({ [login]: ["auth"] }),
      noMatch: () => undefined,
    });

    expect(result).toBeUndefined();
  });
});
