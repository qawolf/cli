import { describe, expect, it, mock } from "bun:test";

import { resolveEnvChoice } from "./resolveEnvChoice.js";

const a1 = "/proj/.qawolf/env-abc/src/flows/login.flow.ts";
const a2 = "/proj/.qawolf/env-abc/src/flows/signup.flow.ts";
const b1 = "/proj/.qawolf/env-xyz/src/flows/login.flow.ts";
const project = "/proj/src/flows/local.flow.ts";

const labels: Record<string, string> = {
  "/proj/.qawolf/env-abc": "staging",
  "/proj/.qawolf/env-xyz": "prod",
};

function makeArgs(over: Partial<Parameters<typeof resolveEnvChoice>[0]> = {}) {
  return {
    files: [a1, b1],
    allEnvs: false,
    mode: "json" as const,
    select: mock(() => Promise.resolve({ ok: true as const, value: "" })),
    readLabel: mock((dir: string) => Promise.resolve(labels[dir] ?? dir)),
    ...over,
  };
}

describe("resolveEnvChoice when there is no ambiguity", () => {
  it("proceeds when every match is in one pulled env", async () => {
    const result = await resolveEnvChoice(makeArgs({ files: [a1, a2] }));

    expect(result).toEqual({ kind: "proceed", files: [a1, a2] });
  });

  it("proceeds for project flows outside any pulled env", async () => {
    const result = await resolveEnvChoice(makeArgs({ files: [project] }));

    expect(result).toEqual({ kind: "proceed", files: [project] });
  });

  it("does not prompt when there is nothing to choose", async () => {
    const select = mock(() =>
      Promise.resolve({ ok: true as const, value: "" }),
    );
    await resolveEnvChoice(
      makeArgs({ files: [a1, a2], mode: "human", select }),
    );

    expect(select).not.toHaveBeenCalled();
  });
});

describe("resolveEnvChoice when matches span several envs", () => {
  // Agents cannot answer a prompt, so the ambiguity has to arrive as an error
  // naming the same choices a human would be offered.
  it("errors in json mode, naming each environment", async () => {
    const result = await resolveEnvChoice(makeArgs({ mode: "json" }));

    if (result.kind !== "error") throw new Error("expected an error");
    expect(result.error).toContain("staging");
    expect(result.error).toContain("prod");
    expect(result.error).toContain("--env");
    expect(result.error).toContain("--all-envs");
  });

  it("errors in agent mode too", async () => {
    const result = await resolveEnvChoice(makeArgs({ mode: "agent" }));

    expect(result.kind).toBe("error");
  });

  it("prompts a human with each environment plus an all option", async () => {
    const select = mock(() =>
      Promise.resolve({ ok: true as const, value: "/proj/.qawolf/env-xyz" }),
    );

    const result = await resolveEnvChoice(makeArgs({ mode: "human", select }));

    const options = (select.mock.calls[0] as unknown[] | undefined)?.[1] as
      | { value: string; label: string }[]
      | undefined;
    expect(options?.map((o) => o.label)).toEqual(["staging", "prod", "All"]);
    expect(result).toEqual({ kind: "proceed", files: [b1] });
  });

  it("runs every match when the human picks all", async () => {
    const select = mock(() =>
      Promise.resolve({ ok: true as const, value: "all" }),
    );

    const result = await resolveEnvChoice(makeArgs({ mode: "human", select }));

    expect(result).toEqual({ kind: "proceed", files: [a1, b1] });
  });

  it("is cancelled when the human dismisses the prompt", async () => {
    const select = mock(() => Promise.resolve({ ok: false as const }));

    const result = await resolveEnvChoice(makeArgs({ mode: "human", select }));

    expect(result).toEqual({ kind: "cancelled" });
  });

  // --all-envs is the non-interactive equivalent of picking All.
  it("skips the question entirely when --all-envs is set", async () => {
    const select = mock(() =>
      Promise.resolve({ ok: true as const, value: "" }),
    );

    const result = await resolveEnvChoice(
      makeArgs({ allEnvs: true, mode: "human", select }),
    );

    expect(select).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "proceed", files: [a1, b1] });
  });

  // A project flow belongs to no environment, so it was never part of the
  // ambiguity and must survive the choice.
  it("keeps project flows when one environment is chosen", async () => {
    const select = mock(() =>
      Promise.resolve({ ok: true as const, value: "/proj/.qawolf/env-xyz" }),
    );

    const result = await resolveEnvChoice(
      makeArgs({ files: [a1, b1, project], mode: "human", select }),
    );

    expect(result).toEqual({ kind: "proceed", files: [project, b1] });
  });
});
