import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Command } from "commander";
import { z } from "zod";

import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerPublicApiCommands } from "./index.js";
import { standInAnnotationJustifications } from "~/domains/publicApi/contract.fixtures.js";

// See index.nested.test.ts for why exitCode is reset to 0.
beforeEach(() => {
  process.exitCode = 0;
});

afterEach(() => {
  process.exitCode = 0;
});

const changeItem = z.strictObject({
  kind: z.enum(["pull-request", "commit"]),
  title: z.string(),
});

const contract = {
  annotations: {
    destructiveHint: false,
    openWorldHint: false,
    readOnlyHint: false,
  },
  annotationJustifications: standInAnnotationJustifications,
  name: "fake.report",
  kind: "write" as const,
  description: "Synthetic JSON-flag contract.",
  input: z.object({
    externalId: z.string(),
    items: z.array(changeItem).describe("What changed."),
  }),
  output: z.object({ ok: z.boolean() }),
};

function registerWith(
  callPublicApi: ReturnType<typeof makeCallPublicApiMock>,
): Command {
  const program = new Command().name("qawolf").exitOverride();
  registerPublicApiCommands(program, createSignalRegistry(), {
    contracts: { fake: { report: contract } },
    authDeps: {
      requireApiKey: async () => ({
        key: "qawolf_key",
        source: "env",
        workspaceId: undefined,
      }),
      createPlatform: () => makeMockPlatformClient({ callPublicApi }),
    },
  });
  return program;
}

const reportCommand = (program: Command): Command | undefined =>
  program.commands
    .find((command) => command.name() === "fake")
    ?.commands.find((command) => command.name() === "report");

describe("registerPublicApiCommands JSON flags", () => {
  it("parses a JSON flag from real argv", async () => {
    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { ok: true },
    });

    await registerWith(callPublicApi).parseAsync(
      [
        "fake",
        "report",
        "--external-id",
        "dpl_123",
        '--items=[{"kind":"commit","title":"Fix the cart total"}]',
      ],
      { from: "user" },
    );

    expect(callPublicApi).toHaveBeenCalledWith(contract, {
      externalId: "dpl_123",
      items: [{ kind: "commit", title: "Fix the cart total" }],
    });
  });

  it("registers a required JSON flag as mandatory and documents it in --help", () => {
    const report = reportCommand(registerWith(makeCallPublicApiMock()));
    const items = report?.options.find((option) => option.long === "--items");

    const help = report?.helpInformation().replace(/\s+/g, " ");

    expect(items?.mandatory).toBe(true);
    expect(help).toContain(
      "--items <json> What changed. Takes JSON inline, @<path> to read it from a file, or - to read it from stdin.",
    );
  });

  it("refuses to run without a required JSON flag", async () => {
    const callPublicApi = makeCallPublicApiMock();
    const program = registerWith(callPublicApi);
    reportCommand(program)?.configureOutput({ writeErr: () => undefined });

    const parsing = program.parseAsync(
      ["fake", "report", "--external-id", "dpl_123"],
      { from: "user" },
    );

    expect(parsing).rejects.toThrow("required option '--items <json>'");
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
