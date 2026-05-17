import { afterEach, describe, expect, it, mock } from "bun:test";

import type { UI } from "~/shell/ui/types.js";

import { renderResults } from "./render.js";
import type { CheckResult } from "./types.js";

afterEach(() => {
  mock.restore();
});

function makeUi(mode: UI["mode"]): UI {
  return {
    mode,
    intro: mock(),
    success: mock(),
    warn: mock(),
    error: mock(),
    json: mock(),
    write: mock(),
  } as unknown as UI;
}

const results: CheckResult[] = [
  { name: "a", status: "pass" },
  { name: "b", status: "warn", detail: "soft" },
  { name: "c", status: "fail", detail: "hard" },
];

describe("renderResults", () => {
  it("emits a single ui.json payload in json mode", () => {
    const ui = makeUi("json");
    renderResults(ui, results);
    expect(ui.json).toHaveBeenCalledTimes(1);
    expect(ui.json).toHaveBeenCalledWith({ checks: results, ok: false });
    expect(ui.success).not.toHaveBeenCalled();
    expect(ui.warn).not.toHaveBeenCalled();
    expect(ui.error).not.toHaveBeenCalled();
  });

  it("reports ok: true when no fails", () => {
    const ui = makeUi("json");
    renderResults(ui, [{ name: "a", status: "pass" }]);
    expect(ui.json).toHaveBeenCalledWith({
      checks: [{ name: "a", status: "pass" }],
      ok: true,
    });
  });

  it("renders one line per check in human mode", () => {
    const ui = makeUi("human");
    renderResults(ui, results);
    expect(ui.intro).toHaveBeenCalledTimes(1);
    expect(ui.success).toHaveBeenCalledWith("a");
    expect(ui.warn).toHaveBeenCalledWith("b: soft");
    expect(ui.error).toHaveBeenCalledWith("c: hard");
  });

  it("writes one prefixed line per check to stderr in agent mode", () => {
    const ui = makeUi("agent");
    renderResults(ui, results);
    expect(ui.write).toHaveBeenCalledTimes(3);
    expect(ui.write).toHaveBeenNthCalledWith(1, "PASS a\n");
    expect(ui.write).toHaveBeenNthCalledWith(2, "WARN b: soft\n");
    expect(ui.write).toHaveBeenNthCalledWith(3, "FAIL c: hard\n");
    expect(ui.intro).not.toHaveBeenCalled();
    expect(ui.success).not.toHaveBeenCalled();
  });
});
