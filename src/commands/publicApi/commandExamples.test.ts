import { Command } from "commander";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { findSubcommand } from "~/commands/help/commandTree.js";
import { buildCommandSpecs } from "~/domains/publicApi/commandSpecs.js";
import {
  negatedFlagPaths,
  skippedContractNames,
} from "~/domains/publicApi/skippedContracts.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

import { commandExamples } from "./commandExamples.js";
import { registerPublicApiCommands } from "./index.js";

const examplePrefix = "$ qawolf ";

function exampleInvocations(
  examples: string,
): { commandPath: string; flags: string[] }[] {
  return examples
    .replaceAll("\\\n", " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(examplePrefix))
    .map((line) => {
      const words = line.slice(examplePrefix.length).split(/\s+/);
      return {
        commandPath: words.slice(0, 2).join(" "),
        flags: words.filter((word) => word.startsWith("--")),
      };
    });
}

function acceptedFlagsByCommandPath(): Map<string, Set<string>> {
  const specs = buildCommandSpecs(publicContractsV1, {
    skipContractNames: skippedContractNames,
    negatedFlagPaths,
  });
  return new Map(
    specs.map((spec) => [
      spec.commandPath.join(" "),
      new Set(spec.flags.flatMap((flag) => flag.flag.split(" ").slice(0, 1))),
    ]),
  );
}

describe("commandExamples", () => {
  it("uses only commands and flags that the installed contracts generate", () => {
    const acceptedFlags = acceptedFlagsByCommandPath();
    const invocations =
      Object.values(commandExamples).flatMap(exampleInvocations);

    const unknown = invocations.flatMap(({ commandPath, flags }) => {
      const accepted = acceptedFlags.get(commandPath);
      if (accepted === undefined) return [commandPath];
      return flags
        .filter((flag) => !accepted.has(flag))
        .map((flag) => `${commandPath} ${flag}`);
    });

    expect(invocations.length).toBeGreaterThan(0);
    expect(unknown).toEqual([]);
  });

  it("prints a command's examples after its generated help", () => {
    const program = new Command("qawolf");
    registerPublicApiCommands(program, makeNoopSignals());
    const command = findSubcommand(program, ["trigger", "create"]);
    const examples = commandExamples["trigger create"];
    if (command === undefined || examples === undefined) {
      throw new Error("trigger create has no command or no examples");
    }
    const written: string[] = [];
    command.configureOutput({ writeOut: (text) => written.push(text) });

    command.outputHelp();

    expect(written.join("")).toContain(examples);
  });
});
