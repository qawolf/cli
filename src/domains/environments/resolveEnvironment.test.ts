import { describe, expect, it } from "bun:test";

import { resolveEnvironment } from "./resolveEnvironment.js";
import { env, makeDeps } from "./resolveEnvironment.testUtils.js";

describe("resolveEnvironment", () => {
  it("returns the trimmed --env flag without any lookup", async () => {
    const { deps, callPublicApi } = makeDeps({});

    const outcome = await resolveEnvironment(deps, {
      explicit: "  staging  ",
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "staging" });
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("falls back to QAWOLF_ENVIRONMENT and notes the source", async () => {
    const { deps, info } = makeDeps({ envVar: " prod " });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "prod" });
    expect(info).toHaveBeenCalledWith(
      "Using environment from QAWOLF_ENVIRONMENT (prod)",
    );
  });

  it("ignores a blank QAWOLF_ENVIRONMENT", async () => {
    const { deps } = makeDeps({ envVar: "   ", mode: "json" });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "error", error: "req" });
  });

  it("errors with the required message in non-human modes", async () => {
    for (const mode of ["json", "agent"] as const) {
      const { deps, callPublicApi } = makeDeps({ mode });

      const outcome = await resolveEnvironment(deps, {
        explicit: undefined,
        requiredMessage: "req",
      });

      expect(outcome).toEqual({ kind: "error", error: "req" });
      expect(callPublicApi).not.toHaveBeenCalled();
    }
  });

  it("errors when the team has no environments", async () => {
    const { deps } = makeDeps({ pages: [{ environments: [] }] });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({
      kind: "error",
      error:
        'No environments found on your team. Create one with "qawolf environment create".',
    });
  });

  it("auto-picks a sole environment and says so", async () => {
    const { deps, select, info } = makeDeps({
      pages: [{ environments: [env("env-1", "Staging")] }],
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "env-1" });
    expect(select).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("Using environment Staging");
    // Auto-picks are frictionless; the export tip only follows a real prompt.
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("prompts with name labels and kind/status hints when several exist", async () => {
    const { deps, select, info } = makeDeps({
      pages: [
        { environments: [env("env-1", "Staging"), env("env-2", "Prod")] },
      ],
      selectAnswers: ["env-2"],
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "env-2" });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith("Which environment?", [
      { value: "env-1", label: "Staging", hint: "static · ready" },
      { value: "env-2", label: "Prod", hint: "static · ready" },
    ]);
    expect(info).toHaveBeenCalledWith(
      "Tip: export QAWOLF_ENVIRONMENT=env-2 to make this your default environment.",
    );
  });

  it("pages through nextCursor before prompting", async () => {
    const { deps, callPublicApi, select } = makeDeps({
      pages: [
        { environments: [env("env-1", "A")], nextCursor: "c2" },
        { environments: [env("env-2", "B")] },
      ],
      selectAnswers: ["env-1"],
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "resolved", env: "env-1" });
    expect(callPublicApi).toHaveBeenCalledTimes(2);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("returns cancelled when the prompt is dismissed", async () => {
    const { deps } = makeDeps({
      pages: [{ environments: [env("env-1", "A"), env("env-2", "B")] }],
      selectCancelled: true,
    });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "cancelled" });
  });

  it("stops with an error when pagination never terminates", async () => {
    const { deps, callPublicApi } = makeDeps({ endlessCursor: true });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({
      kind: "error",
      error:
        "Stopped listing environments after 10 pages. Pass --env explicitly.",
    });
    expect(callPublicApi).toHaveBeenCalledTimes(10);
  });

  it("surfaces a platform error", async () => {
    const { deps } = makeDeps({ findError: "HTTP 500" });

    const outcome = await resolveEnvironment(deps, {
      explicit: undefined,
      requiredMessage: "req",
    });

    expect(outcome).toEqual({ kind: "error", error: "HTTP 500" });
  });
});
