import { expect, it } from "bun:test";
import { stripVTControlCharacters } from "node:util";

import {
  callsOf,
  fakeFilterList,
  makeCtx,
} from "~/shell/commandContext.testUtils.js";

import { flowsList } from "./list.js";
import type { FlowsListRow } from "./renderListTable.js";

for (const [initial, resized] of [
  [20, 200],
  [200, 20],
] as const) {
  it(`prints for the current width after resizing from ${initial} to ${resized}`, async () => {
    let columns: number = initial;
    const fake = fakeFilterList<FlowsListRow>((args) => {
      columns = resized;
      return { ok: true, value: args.items };
    });
    const ctx = makeCtx("human", { isInteractive: true });
    ctx.ui.filterList = fake.filterList;
    await flowsList(
      ctx,
      undefined,
      {
        cwd: "/proj",
        expandPatterns: async () => ["/proj/src/flows/login.flow.ts"],
        peekFlowMeta: async () => ({ name: "Login", target: "Web - Chrome" }),
        readCachedFlows: async () => new Map(),
        readEnvLabel: async () => "staging",
        findPulledEnv: async () => undefined,
        listPulledEnvDirs: async () => [],
      },
      { tags: [] },
      {
        interactive: true,
        get columns() {
          return columns;
        },
      },
    );

    const text = stripVTControlCharacters(
      callsOf(ctx.ui.write)
        .map(([value]) => String(value))
        .join(""),
    );
    if (resized === 200) expect(text).toMatch(/^name\s+target\s+file/m);
    else expect(text).toMatch(/^Login {2}· {2}Web - Chrome$/m);
    expect(text).toContain("login.flow.ts");
  });
}
