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
});
