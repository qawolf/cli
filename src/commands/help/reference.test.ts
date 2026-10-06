import { Command, CommanderError } from "commander";
import { describe, expect, it } from "bun:test";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createProgram } from "~/commands/program.js";
import { findSubcommand } from "./commandTree.js";
import { renderHelpReference } from "./reference.js";

function makeTree(): Command {
  const root = new Command("tool").description("A tool");
  const group = root.command("group").description("A group");
  group
    .command("leaf")
    .description("A leaf")
    .option("--flag", "A flag")
    .addHelpText("before", "Read this first.")
    .addHelpText("after", "\nExamples:\n  $ tool group leaf --flag");
  group.command("secret", { hidden: true }).description("A hidden command");
  return root;
}

function runCli(args: string[]): { out: string; error: unknown } {
  const chunks: string[] = [];
  const program = createProgram({ signals: makeNoopSignals() })
    .exitOverride()
    .configureOutput({
      writeOut: (text) => chunks.push(text),
      writeErr: () => {},
    });
  for (const command of program.commands) {
    command.configureOutput({ writeOut: (text) => chunks.push(text) });
  }
  try {
    program.parse(args, { from: "user" });
    return { out: chunks.join(""), error: undefined };
  } catch (error) {
    return { out: chunks.join(""), error };
  }
}

describe("renderHelpReference", () => {
  it("nests a heading per visible command, each followed by its full help", () => {
    const tree = makeTree();
    const reference = renderHelpReference(tree, ["tool"]);

    expect(reference).toStartWith("# tool\n\n```text\nUsage: tool");
    expect(reference).toContain("\n## tool group\n\n```text\n");
    expect(reference).toContain("\n### tool group leaf\n\n```text\n");
    expect(reference).not.toContain("secret");
  });

  it("includes text added before and after the generated help", () => {
    const leaf = findSubcommand(makeTree(), ["group", "leaf"]);
    if (leaf === undefined) throw new Error("leaf not found");

    expect(renderHelpReference(leaf, ["tool", "group", "leaf"])).toBe(
      [
        "# tool group leaf",
        "",
        "```text",
        "Read this first.",
        "Usage: tool group leaf [options]",
        "",
        "A leaf",
        "",
        "Options:",
        "  --flag      A flag",
        "  -h, --help  display help for command",
        "",
        "Examples:",
        "  $ tool group leaf --flag",
        "```",
        "",
      ].join("\n"),
    );
  });
});

describe("qawolf help", () => {
  it("prints the runner reference", () => {
    const { out, error } = runCli(["help", "ref", "runner"]);

    expect(error).toBeUndefined();
    expect(out).toMatchSnapshot();
  });

  it("accepts reference as an alias of ref", () => {
    expect(runCli(["help", "reference", "runner", "exec"]).out).toBe(
      runCli(["help", "ref", "runner", "exec"]).out,
    );
  });

  it("names a command by its full path", () => {
    expect(runCli(["help", "ref", "runner", "exec"]).out).toStartWith(
      "# qawolf runner exec\n\n",
    );
  });

  it("still prints one command's help", () => {
    const { out, error } = runCli(["help", "runner"]);

    expect(error).toBeUndefined();
    expect(out).toStartWith("Usage: qawolf runner [options] [command]");
  });

  it("rejects an unknown command with exit code 2", () => {
    for (const args of [
      ["help", "ref", "runner", "nope"],
      ["help", "nope"],
    ]) {
      const { error } = runCli(args);

      expect(error).toBeInstanceOf(CommanderError);
      expect((error as CommanderError).code).toBe("commander.unknownCommand");
      expect((error as CommanderError).exitCode).toBe(2);
    }
  });
});
