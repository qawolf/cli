import {
  type BrowserAction,
  publicContractsV1,
} from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import type { BrowserActionFlags } from "~/core/interactiveRunner/browserAction.js";

import { handleRunnerAct } from "./performAction.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const noFlags: BrowserActionFlags = {
  button: undefined,
  keys: undefined,
  path: undefined,
  scrollX: undefined,
  scrollY: undefined,
  text: undefined,
  url: undefined,
  x: undefined,
  y: undefined,
};

// Every shape the published vocabulary has, in the model's own spelling, with the
// flags a caller types and the action those must reach the platform call as.
const shapes: {
  action: BrowserAction;
  flags: Partial<BrowserActionFlags>;
  type: string;
}[] = [
  {
    action: { button: "left", type: "click", x: 480, y: 260 },
    flags: { button: "left", x: "480", y: "260" },
    type: "click",
  },
  {
    action: { type: "double_click", x: 12, y: 34 },
    flags: { x: "12", y: "34" },
    type: "double_click",
  },
  {
    action: { scroll_x: 0, scroll_y: 300, type: "scroll", x: 5, y: 6 },
    flags: { scrollX: "0", scrollY: "300", x: "5", y: "6" },
    type: "scroll",
  },
  {
    action: { type: "move", x: 7, y: 8 },
    flags: { x: "7", y: "8" },
    type: "move",
  },
  {
    action: {
      path: [
        { x: 10, y: 20 },
        { x: 80, y: 90 },
      ],
      type: "drag",
    },
    flags: { path: '[{"x":10,"y":20},{"x":80,"y":90}]' },
    type: "drag",
  },
  {
    action: { keys: ["Control", "a"], type: "keypress" },
    flags: { keys: ["Control", "a"] },
    type: "keypress",
  },
  {
    action: { type: "navigate", url: "https://example.com/login" },
    flags: { url: "https://example.com/login" },
    type: "navigate",
  },
  {
    action: { text: "hello@example.com", type: "type" },
    flags: { text: "hello@example.com" },
    type: "type",
  },
];

describe("handleRunnerAct", () => {
  for (const shape of shapes) {
    it(`sends a ${shape.type} to the runner`, async () => {
      const { callPublicApi, ctx } = makeAuthCtx();
      callPublicApi.mockResolvedValue({
        ok: true,
        value: { outcome: "success" },
      });

      const result = await handleRunnerAct(
        ctx,
        {
          flags: { ...noFlags, ...shape.flags },
          runner: "ci",
          type: shape.type,
        },
        makeTestDeps(),
      );

      expect(result).toBeUndefined();
      expect(callPublicApi).toHaveBeenCalledWith(
        publicContractsV1.runner.performAction,
        { action: shape.action, id: "ci" },
        runnerCallOptions,
      );
    });
  }

  // The runner holds its keyboard for 50 ms per character, so a string over the
  // limit would occupy it for the whole request before being declined. Refusing
  // locally is what keeps the caller from paying for that.
  it("refuses an over-limit typed string locally, naming the limit", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerAct(
      ctx,
      {
        flags: { ...noFlags, text: "a".repeat(201) },
        runner: "ci",
        type: "type",
      },
      makeTestDeps(),
    );

    expect(result?.error).toContain("<=200 characters");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses an out-of-range coordinate locally", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerAct(
      ctx,
      {
        flags: { ...noFlags, button: "left", x: "999999", y: "1" },
        runner: "ci",
        type: "click",
      },
      makeTestDeps(),
    );

    expect(result?.error).toContain("<=20000");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a navigation that is not to http or https locally", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerAct(
      ctx,
      {
        flags: { ...noFlags, url: "file:///etc/passwd" },
        runner: "ci",
        type: "navigate",
      },
      makeTestDeps(),
    );

    expect(result?.error).toContain("Invalid URL");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // An agent with a model's tool call in hand forwards it rather than taking it
  // apart into flags for the CLI to put back together.
  it("takes a whole action as JSON on stdin", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success" },
    });

    await handleRunnerAct(
      ctx,
      { flags: noFlags, runner: "ci", type: "-" },
      makeTestDeps({
        readStdin: async () =>
          '{"type":"click","button":"right","x":3,"y":4}\n',
      }),
    );

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      action: { button: "right", type: "click", x: 3, y: 4 },
      id: "ci",
    });
  });

  it("says so when nothing was piped in, without offering a file", async () => {
    const { ctx } = makeAuthCtx();

    const result = await handleRunnerAct(
      ctx,
      { flags: noFlags, runner: "ci", type: "-" },
      makeTestDeps({ readStdin: async () => "  " }),
    );

    expect(result?.error).toContain("Nothing arrived on stdin");
    expect(result?.error).toContain("name the action type");
    expect(result?.error).not.toContain("name a file");
  });

  it("says what it wanted when stdin did not hold JSON", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerAct(
      ctx,
      { flags: noFlags, runner: "ci", type: "-" },
      makeTestDeps({ readStdin: async () => "click 480 260" }),
    );

    expect(result?.error).toContain('{"type":"click"');
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // Same rule as `act click --text hi`: a flag that cannot reach the runner is
  // answered rather than dropped.
  it("refuses an action flag passed alongside -", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerAct(
      ctx,
      { flags: { ...noFlags, x: "5" }, runner: "ci", type: "-" },
      makeTestDeps({
        readStdin: async () => '{"type":"click","button":"left","x":1,"y":2}',
      }),
    );

    expect(result?.error).toContain("would be ignored");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
