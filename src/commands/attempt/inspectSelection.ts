import type { InspectOptions } from "~/domains/investigation/handle.js";

export type InspectCommandOptions = Omit<
  InspectOptions,
  "actionId" | "requestId" | "screenshotId" | "snapshotId" | "type"
> & {
  action?: string;
  console?: boolean;
  log?: boolean;
  network?: boolean;
  request?: string;
  screenshot?: string;
  snapshot?: string;
  timeline?: boolean;
};

type InspectSelection =
  | { actionId: string; type: "action" }
  | { type: "timeline" }
  | { type: "network" }
  | { requestId: string; type: "request" }
  | { snapshotId: string; type: "snapshot" }
  | { screenshotId: string; type: "screenshot" }
  | { type: "console" }
  | { type: "log" };

export function resolveInspectSelection(
  options: InspectCommandOptions,
): InspectSelection | { error: string } {
  const candidates: (InspectSelection | undefined)[] = [
    options.action === undefined
      ? undefined
      : { actionId: options.action, type: "action" },
    options.timeline ? { type: "timeline" } : undefined,
    options.network ? { type: "network" } : undefined,
    options.request === undefined
      ? undefined
      : { requestId: options.request, type: "request" },
    options.snapshot === undefined
      ? undefined
      : { snapshotId: options.snapshot, type: "snapshot" },
    options.screenshot === undefined
      ? undefined
      : { screenshotId: options.screenshot, type: "screenshot" },
    options.console ? { type: "console" } : undefined,
    options.log ? { type: "log" } : undefined,
  ];
  const selected = candidates.filter(
    (selection): selection is InspectSelection => selection !== undefined,
  );
  return selected.length === 1
    ? selected[0]!
    : {
        error:
          "Choose exactly one evidence selector: --action, --timeline, --network, --request, --snapshot, --screenshot, --console, or --log.",
      };
}
