import { expect, it } from "bun:test";
import { stripVTControlCharacters } from "node:util";

import {
  callsOf,
  fakeFilterList,
  makeCtx,
} from "~/shell/commandContext.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { flowsListRemote } from "./listRemote.js";
import type { FlowsListRow } from "./renderListTable.js";

it("filters remote flows and prints matches at the resized terminal width", async () => {
  let columns = 200;
  const fake = fakeFilterList<FlowsListRow>((args) => {
    columns = 20;
    return { ok: true, value: args.items };
  });
  const ctx = makeCtx("human", { isInteractive: true });
  ctx.ui.filterList = fake.filterList;
  const platformClient = makeMockPlatformClient({
    callPublicApi: makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: {
        flows: [
          {
            flowId: "flow-a",
            name: "Example",
            path: "src/flows/example.flow.ts",
            executionTarget: "Web - Chrome",
            tags: ["smoke"],
            url: "https://example.invalid/flow-a",
          },
        ],
      },
    }),
  });

  await flowsListRemote(
    { ...ctx, platformClient, apiKeySource: "env" },
    undefined,
    { env: "env-a", includeDrafts: false, aiTaskId: undefined, tags: [] },
    {
      interactive: true,
      get columns() {
        return columns;
      },
    },
  );

  expect(fake.calls[0]?.items).toEqual([
    expect.objectContaining({ flowId: "flow-a", tags: ["smoke"] }),
  ]);
  const output = stripVTControlCharacters(
    callsOf(ctx.ui.write)
      .map(([value]) => String(value))
      .join(""),
  );
  expect(output).toMatch(/^Example {2}· {2}Web - Chrome$/m);
  expect(output).toContain("flow-a");
  expect(output).toContain("example.flow.ts");
});
