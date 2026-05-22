import { pathToFileURL } from "node:url";

import { runnerMessages } from "~/core/messages/index.js";

export async function loadFlowDefault<T>(flowPath: string): Promise<T> {
  const mod = (await import(pathToFileURL(flowPath).href)) as Record<
    string,
    unknown
  >;
  const exported = mod["default"] as T | undefined;
  if (exported === undefined) {
    throw new Error(runnerMessages.noDefaultExport(flowPath));
  }
  return exported;
}
