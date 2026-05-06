import type { UI } from "~/lib/ui/types.js";

import type { CheckResult } from "./types.js";

export function renderResults(ui: UI, results: CheckResult[]): void {
  if (ui.mode === "json") {
    ui.json({
      checks: results,
      ok: results.every((r) => r.status !== "fail"),
    });
    return;
  }

  if (ui.mode === "human") ui.intro("qawolf doctor");

  for (const r of results) {
    const line = r.detail ? `${r.name}: ${r.detail}` : r.name;
    switch (r.status) {
      case "pass":
        ui.success(line);
        break;
      case "warn":
        ui.warn(line);
        break;
      case "fail":
        ui.error(line);
        break;
    }
  }
}
