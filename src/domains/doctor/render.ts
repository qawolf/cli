import { doctorMessages } from "~/core/messages/index.js";
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
      ui.write(
        doctorMessages.agentLine(
          result.status,
          result.name,
          result.version,
          result.detail,
        ) + "\n",
      );
    }
    return;
  }

  ui.intro(doctorMessages.intro);

  for (const result of results) {
    const line = doctorMessages.humanLine(
      result.name,
      result.version,
      result.detail,
    );
    if (result.status === "pass") ui.success(line);
    else if (result.status === "warn") ui.warn(line);
    else ui.error(line);
  }
}
