import { describe, expect, it } from "bun:test";

import { resolveEnvironment } from "./resolveEnvironment.js";
import { env, makeDeps } from "./resolveEnvironment.testUtils.js";

describe("resolveEnvironment kind pre-selector", () => {
  it("skips the kind pre-selector when only previews exist", async () => {
    const { deps, select } = makeDeps({
      pages: [
        {
          environments: [
            env("env-1", "PR 1", "preview"),
            env("env-2", "PR 2", "preview"),
          ],
        },
      ],
      selectAnswers: ["env-1"],
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "env-1" });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("pre-selects a kind when both kinds exist, then lists only that kind", async () => {
    const { deps, select } = makeDeps({
      pages: [
        {
          environments: [
            env("env-1", "PR 1", "preview"),
            env("env-2", "PR 2", "preview"),
            env("env-3", "Staging", "static"),
            env("env-4", "Prod", "static"),
          ],
        },
      ],
      selectAnswers: ["preview", "env-2"],
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "env-2" });
    expect(select).toHaveBeenNthCalledWith(1, "Which kind of environment?", [
      { value: "static", label: "Static environments", hint: "2 environments" },
      {
        value: "preview",
        label: "Preview (PR) environments",
        hint: "2 environments",
      },
    ]);
    expect(select).toHaveBeenNthCalledWith(2, "Which environment?", [
      { value: "env-1", label: "PR 1", hint: "preview · ready" },
      { value: "env-2", label: "PR 2", hint: "preview · ready" },
    ]);
  });

  it("auto-picks when the chosen kind has exactly one environment", async () => {
    const { deps, select, info } = makeDeps({
      pages: [
        {
          environments: [
            env("env-1", "PR 1", "preview"),
            env("env-2", "PR 2", "preview"),
            env("env-3", "Staging", "static"),
          ],
        },
      ],
      selectAnswers: ["static"],
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "env-3" });
    expect(select).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith("Using environment Staging");
  });

  it("returns cancelled when the kind prompt is dismissed", async () => {
    const { deps } = makeDeps({
      pages: [
        {
          environments: [
            env("env-1", "PR 1", "preview"),
            env("env-2", "Staging", "static"),
          ],
        },
      ],
      selectCancelled: true,
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "cancelled" });
  });
});
