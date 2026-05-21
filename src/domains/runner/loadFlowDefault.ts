import { pathToFileURL } from "node:url";

export async function loadFlowDefault<T>(flowPath: string): Promise<T> {
  const mod = (await import(pathToFileURL(flowPath).href)) as Record<
    string,
    unknown
  >;
  const exported = mod["default"] as T | undefined;
  if (exported === undefined) {
    throw new Error(`No default export found in "${flowPath}"`);
  }
  return exported;
}
