import type { Command } from "commander";
import { describe, expect, it } from "bun:test";

import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createProgram } from "./program.js";

function buildProgram(): Command {
  return createProgram({ signals: makeNoopSignals() }).configureHelp({
    helpWidth: 80,
  });
}

function findSub(parent: Command, name: string): Command {
  const sub = parent.commands.find((c) => c.name() === name);
  if (sub === undefined) throw new Error(`subcommand not found: ${name}`);
  return sub;
}

function helpFor(...path: string[]): string {
  let cmd = buildProgram();
  for (const segment of path) cmd = findSub(cmd, segment);
  cmd.configureHelp({ helpWidth: 80 });
  let buf = "";
  cmd.configureOutput({
    writeOut: (s) => {
      buf += s;
    },
    writeErr: (s) => {
      buf += s;
    },
  });
  cmd.outputHelp();
  return buf;
}

describe("--help output", () => {
  it("qawolf", () => {
    expect(helpFor()).toMatchSnapshot();
  });

  it("qawolf init", () => {
    expect(helpFor("init")).toMatchSnapshot();
  });

  it("qawolf install", () => {
    expect(helpFor("install")).toMatchSnapshot();
  });

  it("qawolf install browsers", () => {
    expect(helpFor("install", "browsers")).toMatchSnapshot();
  });

  it("qawolf install android", () => {
    expect(helpFor("install", "android")).toMatchSnapshot();
  });

  it("qawolf install clear", () => {
    expect(helpFor("install", "clear")).toMatchSnapshot();
  });

  it("qawolf doctor", () => {
    expect(helpFor("doctor")).toMatchSnapshot();
  });

  it("qawolf flows", () => {
    expect(helpFor("flows")).toMatchSnapshot();
  });

  it("qawolf flows run", () => {
    expect(helpFor("flows", "run")).toMatchSnapshot();
  });

  it("qawolf flows list", () => {
    expect(helpFor("flows", "list")).toMatchSnapshot();
  });

  it("qawolf flows pull", () => {
    expect(helpFor("flows", "pull")).toMatchSnapshot();
  });

  it("qawolf runner", () => {
    expect(helpFor("runner")).toMatchSnapshot();
  });

  it("qawolf runner launch", () => {
    expect(helpFor("runner", "launch")).toMatchSnapshot();
  });

  it("qawolf runner terminate", () => {
    expect(helpFor("runner", "terminate")).toMatchSnapshot();
  });

  it("qawolf runner stop-run", () => {
    expect(helpFor("runner", "stop-run")).toMatchSnapshot();
  });

  it("qawolf runner run", () => {
    expect(helpFor("runner", "run")).toMatchSnapshot();
  });

  it("qawolf runner events", () => {
    expect(helpFor("runner", "events")).toMatchSnapshot();
  });

  it("qawolf runner keepalive", () => {
    expect(helpFor("runner", "keepalive")).toMatchSnapshot();
  });

  it("qawolf runner screenshot", () => {
    expect(helpFor("runner", "screenshot")).toMatchSnapshot();
  });

  it("qawolf runner act", () => {
    expect(helpFor("runner", "act")).toMatchSnapshot();
  });

  it("qawolf runner inspect", () => {
    expect(helpFor("runner", "inspect")).toMatchSnapshot();
  });

  it("qawolf runner inspect element-html", () => {
    expect(helpFor("runner", "inspect", "element-html")).toMatchSnapshot();
  });

  it("qawolf runner inspect page-html", () => {
    expect(helpFor("runner", "inspect", "page-html")).toMatchSnapshot();
  });

  it("qawolf runner inspect variable", () => {
    expect(helpFor("runner", "inspect", "variable")).toMatchSnapshot();
  });

  it("qawolf runner exec", () => {
    expect(helpFor("runner", "exec")).toMatchSnapshot();
  });

  it("contains no em-dashes in any help text", () => {
    const paths: string[][] = [
      [],
      ["init"],
      ["install"],
      ["install", "browsers"],
      ["install", "android"],
      ["install", "clear"],
      ["doctor"],
      ["flows"],
      ["flows", "run"],
      ["flows", "list"],
      ["flows", "pull"],
      ["runner"],
      ["runner", "launch"],
      ["runner", "terminate"],
      ["runner", "stop-run"],
      ["runner", "run"],
      ["runner", "events"],
      ["runner", "keepalive"],
      ["runner", "screenshot"],
      ["runner", "act"],
      ["runner", "exec"],
      ["runner", "inspect"],
      ["runner", "inspect", "element-html"],
      ["runner", "inspect", "page-html"],
      ["runner", "inspect", "variable"],
    ];
    for (const path of paths) {
      expect(helpFor(...path)).not.toContain("—");
    }
  });
});
