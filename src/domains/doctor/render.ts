import type { UI } from "~/shell/ui/types.js";

import type { CheckResult } from "./types.js";

export function renderResults(ui: UI, results: CheckResult[]): void {
  if (ui.mode === "json") {
    const ok = results.every((result) => result.status !== "fail");
    ui.json({ checks: results, ok });
    return;
  }

  if (ui.mode === "agent") {
    for (const result of results) {
      const tail = result.detail ? `: ${result.detail}` : "";
      ui.write(`${result.status.toUpperCase()} ${result.name}${tail}\n`);
    }
    return;
  }

  ui.intro("qawolf doctor");

  for (const result of results) {
    const line = result.detail
      ? `${result.name}: ${result.detail}`
      : result.name;
    if (result.status === "pass") ui.success(line);
    else if (result.status === "warn") ui.warn(line);
    else ui.error(line);
  }
}
