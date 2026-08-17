import { afterEach, describe, expect, it, mock } from "bun:test";

import { runnerMessages } from "~/core/messages/index.js";
import {
  defaultFlags,
  failResult,
  makeCtx,
  makeDeps,
  passResult,
} from "./run.fixtures.js";
import { flowsRun } from "./run.js";

afterEach(() => {
  mock.restore();
});

function expectFailure(result: Awaited<ReturnType<typeof flowsRun>>): {
  error: string;
  errorBody?: string;
} {
  if (result === undefined) throw new Error("expected a failing CommandResult");
  return result;
}

describe("flowsRun failure detail", () => {
  it("attaches the failure cause and stack as errorBody in json mode", async () => {
    const ctx = makeCtx("json");
    const deps = makeDeps({
      metaByFile: { "/a.flow.ts": { target: "Web - Chrome" } },
      runResults: [failResult(new Error("expected title to be 'Dashboard'"))],
    });

    const result = expectFailure(
      await flowsRun(ctx, ["/a.flow.ts"], defaultFlags(), deps),
    );

    expect(result.error).toBe(runnerMessages.flowsFailed(1));
    expect(result.errorBody).toContain("Flow failed on attempt 1");
    expect(result.errorBody).toContain("Caused by:");
    expect(result.errorBody).toContain("expected title to be 'Dashboard'");
  });

  it("attaches the dependency hint for a resolution failure in json mode", async () => {
    const ctx = makeCtx("json");
    const deps = makeDeps({
      metaByFile: { "/a.flow.ts": { target: "Web - Chrome" } },
      projectDir: "/proj",
      runResults: [
        failResult(
          new Error("Cannot find package 'date-fns-tz' imported from"),
        ),
      ],
    });

    const result = expectFailure(
      await flowsRun(ctx, ["/a.flow.ts"], defaultFlags(), deps),
    );

    expect(result.errorBody).toContain(
      runnerMessages.moduleNotFoundHint("date-fns-tz", "/proj"),
    );
  });

  it("joins the detail of every failed flow in json mode", async () => {
    const ctx = makeCtx("json");
    const deps = makeDeps({
      metaByFile: {
        "/a.flow.ts": { target: "Web - Chrome" },
        "/b.flow.ts": { target: "Web - Chrome" },
      },
      runResults: [
        failResult(new Error("first cause")),
        failResult(new Error("second cause")),
      ],
    });

    const result = expectFailure(
      await flowsRun(ctx, ["/a.flow.ts", "/b.flow.ts"], defaultFlags(), deps),
    );

    expect(result.error).toBe(runnerMessages.flowsFailed(2));
    expect(result.errorBody).toContain("first cause");
    expect(result.errorBody).toContain("second cause");
  });

  it("attaches errorBody for pooled runs in json mode", async () => {
    const ctx = makeCtx("json");
    const dispatch = mock(() =>
      Promise.resolve({
        run: failResult(new Error("pooled cause")),
        durationMs: 1,
      }),
    );
    const deps = makeDeps({
      metaByFile: { "/a.flow.ts": { target: "Web - Chrome" } },
      createPooledDispatch: () => dispatch,
    });
    const flags = { ...defaultFlags(), workers: 2 };

    const result = expectFailure(
      await flowsRun(ctx, ["/a.flow.ts"], flags, deps),
    );

    expect(result.error).toBe(runnerMessages.flowsFailed(1));
    expect(result.errorBody).toContain("pooled cause");
  });

  it("omits errorBody in human mode where the reporter already streamed it", async () => {
    const ctx = makeCtx("human");
    const deps = makeDeps({
      metaByFile: { "/a.flow.ts": { target: "Web - Chrome" } },
      runResults: [failResult(new Error("streamed already"))],
    });

    const result = expectFailure(
      await flowsRun(ctx, ["/a.flow.ts"], defaultFlags(), deps),
    );

    expect(result).toEqual({ error: runnerMessages.flowsFailed(1) });
  });

  it("still delivers onFlowFail to the caller's reporter", async () => {
    const ctx = makeCtx("json");
    const deps = makeDeps({
      metaByFile: {
        "/a.flow.ts": { target: "Web - Chrome" },
        "/b.flow.ts": { target: "Web - Chrome" },
      },
      runResults: [failResult(), passResult()],
    });

    await flowsRun(ctx, ["/a.flow.ts", "/b.flow.ts"], defaultFlags(), deps);

    expect(deps.reporter.onFlowFail).toHaveBeenCalledTimes(1);
    expect(deps.reporter.onFlowPass).toHaveBeenCalledTimes(1);
  });
});
