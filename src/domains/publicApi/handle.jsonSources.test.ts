import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import { handlePublicApiCommand } from "./handle.js";
import { changesSpec, ctxWith } from "./handle.testUtils.js";

afterEach(() => {
  mock.restore();
});

const changes = '{"items":[{"kind":"commit","title":"Fix the cart total"}]}';
const parsedChanges = {
  items: [{ kind: "commit", title: "Fix the cart total" }],
};

async function setUp(files: Record<string, string> = {}) {
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value: { ok: true },
  });
  const fs = makeMemoryFs();
  for (const [path, text] of Object.entries(files)) {
    await fs.writeFile(path, text);
  }
  const ctx = {
    ...ctxWith(makeFakeUI(), makeMockPlatformClient({ callPublicApi })),
    fs,
  };
  return { callPublicApi, ctx };
}

const noStdin = { readStdin: mock(async () => "") };

describe("handlePublicApiCommand JSON flag sources", () => {
  it("reads a JSON flag value from a file given as @<path>", async () => {
    const { callPublicApi, ctx } = await setUp({ "/changes.json": changes });
    const spec = changesSpec();

    const result = await handlePublicApiCommand(
      ctx,
      spec,
      { changes: "@/changes.json" },
      noStdin,
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(spec.contract, {
      changes: parsedChanges,
    });
  });

  it("reads a JSON flag value from stdin given as -", async () => {
    const { callPublicApi, ctx } = await setUp();
    const spec = changesSpec();

    const result = await handlePublicApiCommand(
      ctx,
      spec,
      { changes: "-" },
      { readStdin: async () => `${changes}\n` },
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(spec.contract, {
      changes: parsedChanges,
    });
  });

  it("names the file when it does not exist", async () => {
    const { callPublicApi, ctx } = await setUp();

    const result = await handlePublicApiCommand(
      ctx,
      changesSpec(),
      { changes: "@missing.json" },
      noStdin,
    );

    expect(result?.error).toBe(
      'Invalid --changes value: file "missing.json" does not exist.',
    );
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("rejects a file that is not valid JSON without quoting it", async () => {
    const { callPublicApi, ctx } = await setUp({
      "/changes.json": "{items: [secret]}",
    });

    const result = await handlePublicApiCommand(
      ctx,
      changesSpec(),
      { changes: "@/changes.json" },
      noStdin,
    );

    expect(result?.error).toBe(
      "Invalid --changes value: expected a JSON value.",
    );
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("rejects - when nothing was piped to stdin", async () => {
    const { callPublicApi, ctx } = await setUp();

    const result = await handlePublicApiCommand(
      ctx,
      changesSpec(),
      { changes: "-" },
      noStdin,
    );

    expect(result?.error).toBe(
      "Invalid --changes value: nothing was piped to stdin.",
    );
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
