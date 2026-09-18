import { describe, expect, it } from "bun:test";

import { renderFlowsList } from "./renderFlowsList.js";
import type { FlowsListRow } from "./renderListTable.js";

// Renders as "Login  Web - Chrome  src/flows/login.flow.ts": 44 characters.
const row: FlowsListRow = {
  name: "Login",
  target: "Web - Chrome",
  file: "src/flows/login.flow.ts",
  env: undefined,
  tags: undefined,
  flowId: undefined,
};
const rows = [row];

const render = (columns: number | undefined): string =>
  renderFlowsList(rows, { styled: false, columns });

describe("renderFlowsList", () => {
  it("retains IDs and every tag in both human layouts", () => {
    const tags = ["ALPHA", "BETA", "DELTA", "GAMMA"];
    const complete = [
      {
        ...row,
        flowId: "00000000-0000-4000-8000-000000000001",
        tags,
      },
    ];

    for (const columns of [40, 200, undefined]) {
      const output = renderFlowsList(complete, { styled: false, columns });

      expect(output).toContain("00000000-0000-4000-8000-000000000001");
      for (const name of tags) expect(output).toContain(name);
      expect(output).not.toContain("more");
    }
  });

  // Piped output has no width to fit; reflowing for a guess would surprise.
  it("keeps the table when the terminal width is unknown", () => {
    expect(render(undefined)).toMatch(/^name\s+target\s+file/);
  });

  it("keeps the table when it fits", () => {
    expect(render(200)).toMatch(/^name\s+target\s+file/);
  });

  it("keeps the table at exactly the terminal width", () => {
    expect(render(44)).toMatch(/^name\s+target\s+file/);
  });

  it("switches to cards when the table would be wider than the terminal", () => {
    const out = render(43);
    expect(out).not.toMatch(/^name\s+target/);
    expect(out.split("\n")[0]).toBe("Login  ·  Web - Chrome");
  });
});
