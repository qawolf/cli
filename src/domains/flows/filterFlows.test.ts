import { describe, expect, it, mock } from "bun:test";

import { flowsMessages } from "~/core/messages/index.js";
import type { CopyToClipboard } from "~/shell/clipboard.js";
import {
  callsOf,
  fakeFilterList,
  makeFakeUI,
} from "~/shell/commandContext.testUtils.js";
import type { UI } from "~/shell/ui/index.js";

import { filterFlows } from "./filterFlows.js";
import type { FlowsListRow } from "./renderListTable.js";

const file = ".qawolf/env-a/src/flows/view-order-items.flow.ts";

const row = (over: Partial<FlowsListRow> = {}): FlowsListRow => ({
  name: "View Order Items",
  target: "Web - Chrome",
  file,
  env: undefined,
  tags: ["Smoke Tests"],
  flowId: undefined,
  ...over,
});

/** A terminal UI whose filter keeps `kept`, or is cancelled when undefined. */
function uiKeeping(kept: readonly FlowsListRow[] | undefined) {
  const fake = fakeFilterList<FlowsListRow>(() =>
    kept === undefined ? { ok: false } : { ok: true, value: kept },
  );
  const ui: UI = { ...makeFakeUI("human"), filterList: fake.filterList };
  return { ui, offered: () => fake.calls[0] };
}

const copying = () =>
  mock<CopyToClipboard>(() => Promise.resolve("copied" as const));

const written = (ui: UI): string =>
  callsOf(ui.write)
    .map((call) => String(call[0]))
    .join("");

describe("filterFlows", () => {
  it("offers every flow, searchable by its tags too", async () => {
    const { ui, offered } = uiKeeping(undefined);

    await filterFlows(ui, [row()], { columns: 100 }, copying());

    expect(offered()?.items).toEqual([row()]);
    expect(offered()?.message).toBe(
      flowsMessages.list.filterFlows(".qawolf/env-a/"),
    );
    const searchable = offered()?.searchText(row()) ?? [];
    expect(searchable).toContain("Smoke Tests");
  });

  it("offers Ctrl-Y and Ctrl-O to copy paths and ids", async () => {
    const { ui, offered } = uiKeeping(undefined);
    const copy = copying();
    await filterFlows(ui, [row()], { columns: 100 }, copy);

    await offered()
      ?.actions.find((action) => action.key === "y")
      ?.run([row()]);

    expect(offered()?.actions.map((action) => action.key)).toEqual(["y", "o"]);
    expect(copy).toHaveBeenCalledWith(file);
  });

  it("describes the highlighted flow by id and full path", async () => {
    const { ui, offered } = uiKeeping(undefined);

    await filterFlows(ui, [row()], { columns: 100 }, copying());

    expect(offered()?.detail(row({ flowId: "flow-123" }))).toBe(
      `flow-123  ·  ${file}`,
    );
  });

  it("prints every flow the filter kept, in full", async () => {
    const { ui } = uiKeeping([
      row(),
      row({ name: "Other", file: ".qawolf/env-a/src/flows/other.flow.ts" }),
    ]);

    await filterFlows(ui, [row()], { columns: 100 }, copying());

    const out = written(ui);
    expect(out).toContain("View Order Items");
    expect(out).toContain("Other");
    expect(ui.outro).toHaveBeenCalledWith("2 flows");
  });

  it("prints nothing more when the filter is cancelled", async () => {
    const { ui } = uiKeeping(undefined);

    await filterFlows(ui, [row()], { columns: 100 }, copying());

    expect(written(ui)).toBe("");
    expect(ui.outro).not.toHaveBeenCalled();
  });

  it("says no flows matched when the filter kept none", async () => {
    const { ui } = uiKeeping([]);

    await filterFlows(ui, [row()], { columns: 100 }, copying());

    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
  });

  it("says no flows matched, without prompting, when there are none", async () => {
    const { ui, offered } = uiKeeping([]);

    await filterFlows(ui, [], { columns: 100 }, copying());

    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(offered()).toBeUndefined();
  });
});
