import { describe, expect, it } from "bun:test";
import { extractFlowMeta } from "./flowMeta.js";

describe("extractFlowMeta — a list of targets", () => {
  it("should read every target of a list, in order", () => {
    expect(
      extractFlowMeta(
        `flow("Login", { target: ["macOS - Any Mac (Latest)", 'Windows 11 - Desktop',] }, x)`,
      ),
    ).toEqual({
      name: "Login",
      target: undefined,
      targets: ["macOS - Any Mac (Latest)", "Windows 11 - Desktop"],
    });
  });

  it("should read a list that spans lines", () => {
    expect(
      extractFlowMeta(
        `flow(\n  "Login",\n  {\n    target: [\n      "macOS - Any Mac (Latest)",\n      "Windows 11 - Desktop",\n    ],\n  },\n  x,\n)`,
      ).targets,
    ).toEqual(["macOS - Any Mac (Latest)", "Windows 11 - Desktop"]);
  });

  it("should read no list when an entry is not a string literal", () => {
    expect(
      extractFlowMeta(
        `flow("Login", { target: ["macOS - Any Mac (Latest)", windows] }, x)`,
      ),
    ).toEqual({ name: "Login", target: undefined });
  });
});
