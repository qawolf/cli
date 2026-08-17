import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { runnerMessages } from "~/core/messages/index.js";

import { runStagedFlows } from "./runStagedFlows.js";
import {
  cleanupMock,
  debugMock,
  defaultFlags,
  makeCtx,
  makeDeps,
  prepareRunDirMock,
  resetStagedRunMocks,
  uiWarnMock,
} from "./runStagedFlows.testUtils.js";

beforeEach(() => {
  resetStagedRunMocks();
});

afterEach(() => {
  mock.restore();
});

describe("runStagedFlows outer-hop reporting", () => {
  it("debug-logs rejected outer-hop candidates when the fallback install ran", async () => {
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/run/exec/flow.ts"],
      runDir: "/mock/run",
      outerHop: {
        mode: "install",
        depCount: 1,
        rejected: [{ dir: "/host/node_modules", missing: ["date-fns"] }],
        carriedOver: [],
      },
      cleanup: cleanupMock,
    });

    await runStagedFlows({
      ctx: makeCtx(),
      files: ["/some/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(debugMock).toHaveBeenCalledWith(
      runnerMessages.outerHopCandidateRejected("/host/node_modules", [
        "date-fns",
      ]),
    );
  });

  it("warns which node_modules the fallback install rejected and why", async () => {
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/run/exec/flow.ts"],
      runDir: "/mock/run",
      outerHop: {
        mode: "install",
        depCount: 1,
        rejected: [
          { dir: "/proj/node_modules", missing: ["csv-parser"] },
          { dir: "/host/node_modules", missing: ["csv-parser", "date-fns"] },
        ],
        carriedOver: [],
      },
      cleanup: cleanupMock,
    });

    await runStagedFlows({
      ctx: makeCtx(["/proj"]),
      files: ["/proj/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(uiWarnMock).toHaveBeenCalledWith(
      runnerMessages.outerHopFallbackNotice("/proj/node_modules", [
        "csv-parser",
      ]),
    );
  });

  it("reports the undeclared packages the fallback carried over", async () => {
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/run/exec/flow.ts"],
      runDir: "/mock/run",
      outerHop: {
        mode: "install",
        depCount: 1,
        rejected: [{ dir: "/proj/node_modules", missing: ["csv-parser"] }],
        carriedOver: ["date-fns-tz"],
      },
      cleanup: cleanupMock,
    });

    await runStagedFlows({
      ctx: makeCtx(["/proj"]),
      files: ["/proj/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(uiWarnMock).toHaveBeenCalledWith(
      runnerMessages.outerHopCarriedOver(["date-fns-tz"]),
    );
  });

  it("never tells the user to run npm install in an ancestor node_modules", async () => {
    // The nearest rejected candidate is an unrelated repo the project sits
    // inside whenever the project has no node_modules of its own.
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/run/exec/flow.ts"],
      runDir: "/mock/run",
      outerHop: {
        mode: "install",
        depCount: 1,
        rejected: [{ dir: "/host/node_modules", missing: ["csv-parser"] }],
        carriedOver: [],
      },
      cleanup: cleanupMock,
    });

    await runStagedFlows({
      ctx: makeCtx(["/host/proj"]),
      files: ["/host/proj/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(uiWarnMock).not.toHaveBeenCalled();
  });
});
