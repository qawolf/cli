import type { BrowserName } from "~/core/types.js";

import type { FlowsListRow } from "./renderListTable.js";

/** One flow as `flows list` reports it; `--json` emits these verbatim. */
export type FlowsListItem = {
  file: string;
  name: string;
  // Undefined for project flows and pulls made before IDs were recorded.
  flowId: string | undefined;
  // The pulled environment the flow came from. Undefined for project flows,
  // which belong to no environment.
  env: string | undefined;
  // Absent when the flow was never pulled, so its tags are unknown rather
  // than known to be empty.
  tags: readonly string[] | undefined;
  target: string | undefined;
  browser: BrowserName | undefined;
};

export const toListRow = (it: FlowsListItem): FlowsListRow => ({
  name: it.name,
  flowId: it.flowId,
  target: it.target,
  env: it.env,
  tags: it.tags,
  file: it.file,
});
