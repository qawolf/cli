import { describe, expect, it } from "bun:test";

import { selectFlowFiles } from "./selectFlowFiles.js";

const cwd = "/proj";
const login = "/proj/src/flows/checkout/login.flow.ts";
const invoice = "/proj/src/flows/billing/invoice.flow.ts";

describe("selectFlowFiles", () => {
  it("returns every file when no selector is given", () => {
    const result = selectFlowFiles({
      files: [login, invoice],
      cwd,
      selectors: { tags: [] },
      tagsByPath: undefined,
    });

    expect(result).toEqual({ kind: "selected", files: [login, invoice] });
  });

  it("keeps files carrying any of the named tags", () => {
    const result = selectFlowFiles({
      files: [login, invoice],
      cwd,
      selectors: { tags: ["auth"] },
      tagsByPath: new Map([
        ["src/flows/checkout/login.flow.ts", ["auth"]],
        ["src/flows/billing/invoice.flow.ts", ["billing"]],
      ]),
    });

    expect(result).toEqual({ kind: "selected", files: [login] });
  });

  // Pulled flows live under .qawolf/<env>/, which has to come off before the
  // path can be looked up in a tag map keyed by repo-relative path.
  it("matches a pulled flow on its repo-relative path", () => {
    const pulled = "/proj/.qawolf/staging/src/flows/checkout/login.flow.ts";
    const result = selectFlowFiles({
      files: [pulled],
      cwd,
      selectors: { tags: ["auth"] },
      tagsByPath: new Map([["src/flows/checkout/login.flow.ts", ["auth"]]]),
    });

    expect(result).toEqual({ kind: "selected", files: [pulled] });
  });

  it("reports empty when the tag matches nothing", () => {
    const result = selectFlowFiles({
      files: [login, invoice],
      cwd,
      selectors: { tags: ["nope"] },
      tagsByPath: new Map([["src/flows/checkout/login.flow.ts", ["auth"]]]),
    });

    expect(result).toEqual({ kind: "empty" });
  });

  // An unfiltered run that simply has no files is not a selection failure.
  it("returns an empty selection rather than a failure without selectors", () => {
    const result = selectFlowFiles({
      files: [],
      cwd,
      selectors: { tags: [] },
      tagsByPath: undefined,
    });

    expect(result).toEqual({ kind: "selected", files: [] });
  });

  it("never matches a file whose tags are unknown", () => {
    const result = selectFlowFiles({
      files: [login],
      cwd,
      selectors: { tags: ["auth"] },
      tagsByPath: new Map(),
    });

    expect(result).toEqual({ kind: "empty" });
  });
});
