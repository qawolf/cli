import { flowsMessages } from "~/core/messages/index.js";
import type { CopyToClipboard } from "~/shell/clipboard.js";
import { formatClipboardPaths } from "~/shell/clipboardPaths.js";
import type { FilterAction, FilterNotice } from "~/shell/ui/renderers/types.js";

import type { FlowsListRow } from "./renderListTable.js";

export function copyFlowActions(
  copy: CopyToClipboard,
  formatPaths = formatClipboardPaths,
): FilterAction<FlowsListRow>[] {
  // Quote individual paths before joining, so shell syntax stays literal.
  const copied = async (
    values: readonly string[],
    noun: "path" | "id",
  ): Promise<FilterNotice> => {
    const formatted =
      noun === "path"
        ? formatPaths(values)
        : { text: values.join(" "), syntax: undefined };
    const message =
      (await copy(formatted.text)) === "copied"
        ? flowsMessages.list.copied(values, noun)
        : flowsMessages.list.copiedViaTerminal(values, noun);
    return {
      tone: "success",
      text: formatted.syntax ? `${message} · ${formatted.syntax}` : message,
    };
  };

  return [
    {
      key: "y",
      label: flowsMessages.list.copyPath,
      run: (rows) =>
        copied(
          rows.map((row) => row.file),
          "path",
        ),
    },
    {
      key: "o",
      label: flowsMessages.list.copyId,
      run: async (rows) => {
        const ids = rows.flatMap((row) =>
          row.flowId === undefined ? [] : [row.flowId],
        );
        if (ids.length === 0) {
          return { tone: "warning", text: flowsMessages.list.noFlowId };
        }
        const notice = await copied(ids, "id");
        const missing = rows.length - ids.length;
        // The ids that are known still help, but the gap must not go unseen.
        return missing === 0
          ? notice
          : {
              tone: "warning",
              text: `${notice.text} · ${flowsMessages.list.idsLeftOut(missing)}`,
            };
      },
    },
  ];
}
