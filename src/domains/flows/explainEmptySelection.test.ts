import { describe, expect, it } from "bun:test";

import { explainEmptySelection } from "./explainEmptySelection.js";

describe("explainEmptySelection", () => {
  // Tags are team-scoped, so a tag absent from this env's flows may still be a
  // real tag. Without a validated team tag list we must not call it unknown.
  it("does not call a tag unknown when the team tag list is unavailable", () => {
    expect(explainEmptySelection({ tags: ["auth"] })).toBe(
      "No flows matched tags auth.",
    );
  });

  it("reports an unknown tag once the team tag list is known", () => {
    expect(explainEmptySelection({ tags: ["aut"] }, ["auth", "smoke"])).toBe(
      "No tag named 'aut' on this team. Did you mean 'auth'?",
    );
  });

  it("points at tag list when nothing is close enough to suggest", () => {
    expect(explainEmptySelection({ tags: ["zzz"] }, ["auth"])).toBe(
      "No tag named 'zzz' on this team. Run 'qawolf tag list' to see available tags.",
    );
  });

  it("reports a real tag that simply matched nothing here", () => {
    expect(explainEmptySelection({ tags: ["auth"] }, ["auth", "smoke"])).toBe(
      "No flows matched tags auth.",
    );
  });

  it("names every tag that was asked for", () => {
    expect(
      explainEmptySelection({ tags: ["auth", "smoke"] }, ["auth", "smoke"]),
    ).toBe("No flows matched tags auth, smoke.");
  });
});
