import { describe, expect, it } from "bun:test";

import { findMissingEnvVars } from "./missing.js";

describe("findMissingEnvVars", () => {
  const byFlow = (entries: Record<string, string[]>) =>
    new Map(
      Object.entries(entries).map(([path, names]) => [
        path,
        { names, mayBeIncomplete: false },
      ]),
    );

  it("reports a variable no flow's environment defines", () => {
    expect(
      findMissingEnvVars({
        byFlow: byFlow({ "a.flow.ts": ["PRESENT", "ABSENT"] }),
        definedNames: new Set(["PRESENT"]),
      }),
    ).toEqual([{ name: "ABSENT", flowCount: 1 }]);
  });

  it("counts how many flows read each missing variable", () => {
    expect(
      findMissingEnvVars({
        byFlow: byFlow({
          "a.flow.ts": ["SHARED"],
          "b.flow.ts": ["SHARED"],
          "c.flow.ts": ["RARE"],
        }),
        definedNames: new Set(),
      }),
    ).toEqual([
      { name: "SHARED", flowCount: 2 },
      { name: "RARE", flowCount: 1 },
    ]);
  });

  it("breaks ties on count by name", () => {
    expect(
      findMissingEnvVars({
        byFlow: byFlow({ "a.flow.ts": ["ZED", "ALPHA"] }),
        definedNames: new Set(),
      }).map((m) => m.name),
    ).toEqual(["ALPHA", "ZED"]);
  });

  it("ignores runner- and OS-provided variables", () => {
    expect(
      findMissingEnvVars({
        byFlow: byFlow({
          "a.flow.ts": ["QAWOLF_EXAMPLE_ID", "TEAM_STORAGE_DIR", "HOME"],
        }),
        definedNames: new Set(),
      }),
    ).toEqual([]);
  });

  it("reports nothing when the environment defines everything", () => {
    expect(
      findMissingEnvVars({
        byFlow: byFlow({ "a.flow.ts": ["ALPHA", "BETA"] }),
        definedNames: new Set(["ALPHA", "BETA"]),
      }),
    ).toEqual([]);
  });
});
