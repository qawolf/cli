import { describe, expect, it } from "bun:test";
import { Command } from "commander";
import { z } from "zod";

import { standInAnnotationJustifications } from "~/domains/publicApi/contract.fixtures.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerPublicApiCommands } from "./index.js";

function fakeContract(name: string, output: z.ZodType) {
  return {
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
    annotationJustifications: standInAnnotationJustifications,
    name,
    kind: "read" as const,
    description: `synthetic ${name} contract`,
    input: z.object({ attemptId: z.string() }),
    output,
  };
}

describe("registerPublicApiCommands --output-file", () => {
  it("offers --output-file only on commands whose answer carries an image", () => {
    const program = new Command().name("qawolf").exitOverride();

    registerPublicApiCommands(program, createSignalRegistry(), {
      contracts: {
        fake: {
          frame: fakeContract(
            "fake.frame",
            z.object({ imageJpegBase64: z.string(), index: z.number() }),
          ),
          get: fakeContract("fake.get", z.object({ index: z.number() })),
        },
      },
    });

    const fake = program.commands.find((command) => command.name() === "fake");
    const flagsOf = (name: string) =>
      fake?.commands
        .find((command) => command.name() === name)
        ?.options.map((option) => option.flags);
    expect(flagsOf("frame")).toEqual([
      "--attempt-id <value>",
      "--output-file <path>",
    ]);
    expect(flagsOf("get")).toEqual(["--attempt-id <value>"]);
  });
});
