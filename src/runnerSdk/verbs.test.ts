import { describe, expect, it } from "bun:test";

import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

import type { SdkContext } from "./createContext.js";
import { createLifecycleVerbs } from "./lifecycleVerbs.js";
import { createPageVerbs } from "./pageVerbs.js";
import { createProjectVerbs } from "./projectVerbs.js";

type Sent = { input: unknown; name: string };

const packageJson = JSON.stringify({
  dependencies: { dayjs: "1.11.13" },
  devDependencies: { typescript: "5.9.3" },
});

const scopeFiles = {
  "src/pages/helper.ts": "export const helper = 2;",
  "src/pages/login.ts": "export const login = 1;",
};

function makeContext(answer: unknown = { outcome: "success" }) {
  const sent: Sent[] = [];
  const platformClient = {
    callPublicApi: async (contract: { name: string }, input: unknown) => {
      sent.push({ input, name: contract.name });
      return { ok: true as const, value: answer };
    },
  } as unknown as PlatformClient;

  const deps = {
    collectRunFiles: async () => ({ files: scopeFiles }),
    cwd: "/workspace",
    readFile: async () => packageJson,
  };
  const context = { deps, platformClient } as unknown as SdkContext;
  return {
    lifecycle: createLifecycleVerbs(context),
    page: { ...createPageVerbs(context), ...createProjectVerbs(context) },
    sent,
  };
}

describe("the input each verb sends", () => {
  it("names the runner family only when one is chosen", async () => {
    const { lifecycle, sent } = makeContext();

    await lifecycle.launch({ id: "agent-1", runnerFamily: "default" });
    await lifecycle.launch({
      id: "agent-1",
      runnerFamily: { name: "playwright" },
    });

    expect(sent[0]).toEqual({
      input: { id: "agent-1" },
      name: "runner.launch",
    });
    expect(sent[1]?.input).toEqual({ id: "agent-1", runnerName: "playwright" });
  });

  it("keeps a runner alive with a one-entry journal read", async () => {
    const { lifecycle, sent } = makeContext();

    await lifecycle.keepalive({ runnerId: "agent-1" });

    expect(sent[0]).toEqual({
      input: { id: "agent-1", stream: "run-status", tail: 1 },
      name: "runner.readJournal",
    });
  });

  it("sends an empty selector to clear a highlight", async () => {
    const { page, sent } = makeContext();

    await page.highlightSelector({ highlight: "clear", runnerId: "agent-1" });
    await page.highlightSelector({
      highlight: { selector: "text=Sign in" },
      runnerId: "agent-1",
    });

    expect(sent[0]?.input).toEqual({ id: "agent-1", selector: "" });
    expect(sent[1]?.input).toEqual({
      id: "agent-1",
      selector: "text=Sign in",
    });
  });

  it("resolves latest rather than sending a version the caller did not pick", async () => {
    const { page, sent } = makeContext();

    await page.importPackage({
      name: "dayjs",
      runnerId: "agent-1",
      version: "latest",
    });
    await page.importPackage({
      name: "dayjs",
      runnerId: "agent-1",
      version: { exact: "1.11.13" },
    });

    expect(sent[0]?.input).toMatchObject({ packageVersion: "latest" });
    expect(sent[1]?.input).toMatchObject({ packageVersion: "1.11.13" });
  });
});

describe("what a caller gets back", () => {
  it("hands the runner's own refusal back rather than throwing", async () => {
    const { lifecycle } = makeContext({
      failureReason: "runner-unreachable",
      outcome: "failure",
    });

    const answer = await lifecycle.stopRun({ runnerId: "agent-1" });

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.value.outcome).toBe("failure");
  });

  it("carries no exit code on a transport failure", async () => {
    const platformClient = {
      callPublicApi: async () => ({
        error: "The request failed.",
        exitCode: 4,
        ok: false as const,
      }),
    } as unknown as PlatformClient;
    const { terminate } = createLifecycleVerbs({
      deps: {},
      platformClient,
    } as unknown as SdkContext);

    const answer = await terminate({ runnerId: "agent-1" });

    expect(answer).toEqual({ error: "The request failed.", ok: false });
  });
});

describe("what the CLI sends that a hand-written input would miss", () => {
  it("resolves the project's npm dependencies rather than sending none", async () => {
    const { page, sent } = makeContext();

    await page.importPackage({
      name: "dayjs",
      runnerId: "agent-1",
      version: "latest",
    });

    expect(sent[0]?.input).toMatchObject({
      npmDependencies: { dayjs: "1.11.13", typescript: "5.9.3" },
    });
  });

  it("refuses rather than installing against nothing when package.json is absent", async () => {
    const sent: Sent[] = [];
    const platformClient = {
      callPublicApi: async (contract: { name: string }, input: unknown) => {
        sent.push({ input, name: contract.name });
        return { ok: true as const, value: { outcome: "success" } };
      },
    } as unknown as PlatformClient;
    const { importPackage } = createProjectVerbs({
      deps: {
        cwd: "/workspace",
        readFile: async (): Promise<string> => {
          throw new Error("ENOENT");
        },
      },
      platformClient,
    } as unknown as SdkContext);

    const answer = await importPackage({
      name: "dayjs",
      runnerId: "agent-1",
      version: "latest",
    });

    expect(answer.ok).toBe(false);
    expect(sent).toEqual([]);
  });

  // A runner holds no copy of the project, so naming a scope whose files never
  // arrive is worse than sending no scope at all.
  it("ships the scope's files alongside its path", async () => {
    const { page, sent } = makeContext();

    await page.evaluateSnippet({
      runnerId: "agent-1",
      scope: { filePath: "src/pages/login.ts" },
      source: "1",
    });

    expect(sent[0]?.input).toMatchObject({
      filePath: "src/pages/login.ts",
      files: scopeFiles,
    });
  });

  it("sends neither a path nor files when the snippet imports nothing", async () => {
    const { page, sent } = makeContext();

    await page.evaluateSnippet({
      runnerId: "agent-1",
      scope: "no-imports",
      source: "1",
    });

    expect(sent[0]?.input).toEqual({ code: "1", id: "agent-1" });
  });
});
