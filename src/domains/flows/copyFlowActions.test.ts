import { describe, expect, it, mock } from "bun:test";
import { spawnSync } from "node:child_process";

import { flowsMessages } from "~/core/messages/index.js";
import type { CopyToClipboard } from "~/shell/clipboard.js";
import { formatClipboardPaths } from "~/shell/clipboardPaths.js";

import { copyFlowActions } from "./copyFlowActions.js";
import type { FlowsListRow } from "./renderListTable.js";

const row = (name: string, flowId: string | undefined): FlowsListRow => ({
  name,
  target: "Web - Chrome",
  file: `src/flows/${name}.flow.ts`,
  env: undefined,
  tags: undefined,
  flowId,
});

/** The actions, over a clipboard that answers `outcome`. */
function setup(
  outcome: "copied" | "terminal" = "copied",
  platform: NodeJS.Platform = "linux",
) {
  const copy = mock<CopyToClipboard>(() => Promise.resolve(outcome));
  const actions = copyFlowActions(copy, (paths) =>
    formatClipboardPaths(paths, platform),
  );
  const run = (key: string, rows: FlowsListRow[]) =>
    actions.find((action) => action.key === key)?.run(rows);
  return { copy, run };
}

describe("copyFlowActions", () => {
  it("copies one flow's path with Ctrl-Y, naming it", async () => {
    const { copy, run } = setup();

    const notice = await run("y", [row("a", undefined)]);

    expect(copy).toHaveBeenCalledWith("src/flows/a.flow.ts");
    expect(notice).toEqual({
      tone: "success",
      text: "Copied src/flows/a.flow.ts",
    });
  });

  // So they paste straight into one command.
  it("separates several paths with spaces, and counts them", async () => {
    const { copy, run } = setup();

    const notice = await run("y", [row("a", undefined), row("b", undefined)]);

    expect(copy).toHaveBeenCalledWith(
      "src/flows/a.flow.ts src/flows/b.flow.ts",
    );
    expect(notice).toEqual({ tone: "success", text: "Copied 2 paths" });
  });

  it("copies the flow ids with Ctrl-O", async () => {
    const { copy, run } = setup();

    const notice = await run("o", [row("a", "id-1"), row("b", "id-2")]);

    expect(copy).toHaveBeenCalledWith("id-1 id-2");
    expect(notice).toEqual({ tone: "success", text: "Copied 2 ids" });
  });

  for (const shell of ["sh", "bash", "zsh"]) {
    // This corpus includes POSIX filenames with control characters. Windows
    // copies PowerShell syntax, covered by clipboardPaths.test.ts.
    it.skipIf(
      process.platform === "win32" ||
        spawnSync(shell, ["-c", "exit 0"]).error !== undefined,
    )(
      `preserves each copied path as one literal argument in ${shell}`,
      async () => {
        const { copy, run } = setup();
        const files = [
          "src/flows/checkout cart.flow.ts",
          "src/flows/customer's cart.flow.ts",
          "src/flows/payments[1].flow.ts",
          "src/flows/$USER.flow.ts",
          "src/flows/$(printf injected).flow.ts",
          "src/flows/`printf injected`.flow.ts",
          "src/flows/semicolon; printf injected",
          "src/flows/first\nsecond.flow.ts",
          "src/flows/trailing.flow.ts\n",
          "src/flows/carriage.flow.ts\r",
          "src/flows/back\\slash.flow.ts",
          'src/flows/"quoted".flow.ts',
          "#comment.flow.ts",
          "~/literal.flow.ts",
          "src/flows/{a,b}?.flow.ts",
          "src/flows/!history.flow.ts",
        ];

        await run(
          "y",
          files.map((file) => ({ ...row("a", undefined), file })),
        );
        const copied = copy.mock.calls[0]?.[0];
        expect(copied).toBeDefined();
        const result = spawnSync(shell, ["-c", `printf '%s\\0' ${copied}`], {
          encoding: "utf8",
        });

        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout.split("\0").slice(0, -1)).toEqual(files);
      },
    );
  }

  for (const outcome of ["copied", "terminal"] as const) {
    it(`names the Windows quoting format when ${outcome}`, async () => {
      const { copy, run } = setup(outcome, "win32");

      const notice = await run("y", [row("customer's cart", undefined)]);

      expect(copy).toHaveBeenCalledWith("'src/flows/customer''s cart.flow.ts'");
      expect(notice?.text).toEndWith(" · PowerShell syntax");
    });
  }

  it("says a flow has no id yet rather than copying nothing", async () => {
    const { copy, run } = setup();

    const notice = await run("o", [row("a", undefined)]);

    expect(notice).toEqual({
      tone: "warning",
      text: flowsMessages.list.noFlowId,
    });
    expect(copy).not.toHaveBeenCalled();
  });

  it("copies the ids that are known, and warns about the rest", async () => {
    const { copy, run } = setup();

    const notice = await run("o", [
      row("a", "id-1"),
      row("b", undefined),
      row("c", undefined),
    ]);

    expect(copy).toHaveBeenCalledWith("id-1");
    expect(notice).toEqual({
      tone: "warning",
      text: "Copied id-1 · 2 flows had no id yet and were left out",
    });
  });

  it("says when the terminal was asked to copy instead", async () => {
    const { run } = setup("terminal");

    const notice = await run("y", [row("a", undefined), row("b", undefined)]);

    expect(notice).toEqual({
      tone: "success",
      text: "Sent 2 paths to your terminal's clipboard",
    });
  });
});
