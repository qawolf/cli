import { describe, expect, it } from "bun:test";
import ts from "typescript";

import { readEnvVarsFrom } from "./envReads.js";

function reads(source: string): { names: string[]; dynamic: boolean } {
  const file = ts.createSourceFile(
    "a.flow.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const names = new Set<string>();
  let dynamic = false;
  const visit = (node: ts.Node): void => {
    const result = readEnvVarsFrom(ts, node, () => false);
    for (const name of result.names) names.add(name);
    dynamic ||= result.dynamic;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { names: [...names].sort(), dynamic };
}

describe("environment read syntax", () => {
  it("reads property, bracket, template, and destructured names", () => {
    expect(
      reads(
        'process.env.DIRECT; process.env["BRACKET"]; process.env[`TEMPLATE`]; const { BOUND: value } = process.env;',
      ),
    ).toEqual({
      names: ["BOUND", "BRACKET", "DIRECT", "TEMPLATE"],
      dynamic: false,
    });
  });

  it("excludes write-only assignments and deletes while retaining compound reads", () => {
    expect(
      reads(`export default () => {
      process.env.WRITTEN = "generated";
      process.env["BRACKET_WRITTEN"] = "generated";
      delete process.env.DELETED;
      delete process.env["BRACKET_DELETED"];
      process.env.UPDATED += "suffix";
      process.env.FALLBACK ??= "fallback";
      process.env.COPIED = process.env.READ;
      ({ token: process.env.DESTRUCTURED } = { token: "generated" });
      [process.env.ARRAY_WRITTEN] = ["generated"];
    };`),
    ).toEqual({
      names: ["FALLBACK", "READ", "UPDATED"],
      dynamic: false,
    });
  });

  it("excludes loop write targets while retaining iterable reads", () => {
    expect(
      reads(`for (process.env.TARGET of [process.env.VALUE]) {}
        for (process.env["KEY"] in { [process.env.SOURCE]: true }) {}
        for ({ key: process.env.OBJECT } of rows) {}
        for ([process.env.ARRAY] of rows) {}`),
    ).toEqual({ names: ["SOURCE", "VALUE"], dynamic: false });
  });

  it("accepts static names containing template markers", () => {
    expect(
      reads('process.env["TOKEN${SUFFIX}"]; process.env[`LITERAL\\${KEY}`];'),
    ).toEqual({ names: ["LITERAL${KEY}", "TOKEN${SUFFIX}"], dynamic: false });
  });

  it.each([
    "const env = process.env; env.TOKEN;",
    "use(process.env);",
    "({ ...process.env });",
    "Object.keys(process.env);",
  ])("flags an unhandled environment object read: %s", (source) => {
    expect(reads(source)).toEqual({ names: [], dynamic: true });
  });

  it("excludes writes to the environment object", () => {
    expect(
      reads(`process.env = {}; delete process.env;
      for (process.env of objects) {}`),
    ).toEqual({ names: [], dynamic: false });
  });

  it("reads quoted and computed literal destructuring keys", () => {
    expect(
      reads(`const { "TOKEN": token, ["USER"]: user } = process.env;`),
    ).toEqual({
      names: ["TOKEN", "USER"],
      dynamic: false,
    });
  });

  it.each([
    `const { [key]: value } = process.env;`,
    `process.env[key];`,
    "process.env[`${key}_EMAIL`];",
    `const { ...rest } = process.env;`,
  ])("flags a dynamic read: %s", (source) => {
    expect(reads(source)).toEqual({ names: [], dynamic: true });
  });

  it("retains known names alongside uncertainty", () => {
    expect(reads(`const { KNOWN, ...rest } = process.env;`)).toEqual({
      names: ["KNOWN"],
      dynamic: true,
    });
  });

  it("does not read a name out of a comment", () => {
    expect(
      reads(
        `// process.env.COMMENT\n/** process.env.JSDOC */\nprocess.env.REAL;`,
      ),
    ).toEqual({
      names: ["REAL"],
      dynamic: false,
    });
  });
});
