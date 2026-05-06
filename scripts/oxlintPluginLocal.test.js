import { describe, expect, it } from "bun:test";
import plugin from "./oxlintPluginLocal.js";

describe("require-js-extension rule", () => {
  const rule = plugin.rules["require-js-extension"];

  function makeContext() {
    const nodeMap = new Map();
    const reported = [];
    return {
      sourceCode: {
        getText(node) {
          return nodeMap.get(node) || `"${node.value}"`;
        },
      },
      report(issue) {
        reported.push(issue);
      },
      get reported() {
        return reported;
      },
      setNodeText(node, text) {
        nodeMap.set(node, text);
      },
    };
  }

  function testNode(type, sourceValue, shouldReport) {
    const ctx = makeContext();
    const sourceNode = { value: sourceValue };
    ctx.setNodeText(sourceNode, `"${sourceValue}"`);

    const node = { type, source: sourceNode };

    rule.create(ctx)[type](node);

    if (shouldReport) {
      expect(ctx.reported).toHaveLength(1);
      expect(ctx.reported[0].message).toContain(
        `Relative import "${sourceValue}" must use a .js extension.`,
      );
    } else {
      expect(ctx.reported).toHaveLength(0);
    }
  }

  it("should report ImportDeclaration without extension", () => {
    testNode("ImportDeclaration", "./module", true);
  });

  it("should report ExportNamedDeclaration with source", () => {
    testNode("ExportNamedDeclaration", "./module", true);
  });

  it("should report ExportAllDeclaration with source", () => {
    testNode("ExportAllDeclaration", "../shared", true);
  });

  it("should not report with .js extension", () => {
    testNode("ImportDeclaration", "./module.js", false);
  });

  it("should not report non-relative imports", () => {
    testNode("ImportDeclaration", "react", false);
  });

  it("should not report ExportNamedDeclaration without source", () => {
    const ctx = makeContext();
    const node = { type: "ExportNamedDeclaration", source: undefined };

    rule.create(ctx).ExportNamedDeclaration(node);

    expect(ctx.reported).toHaveLength(0);
  });

  it("should provide working fix function", () => {
    const ctx = makeContext();
    const sourceNode = { value: "./module" };
    ctx.setNodeText(sourceNode, '"./module"');

    const node = { type: "ImportDeclaration", source: sourceNode };

    rule.create(ctx).ImportDeclaration(node);

    expect(ctx.reported).toHaveLength(1);

    const fixer = {
      replaceText(_node, text) {
        return { range: [0, 100], text };
      },
    };

    const result = ctx.reported[0].fix(fixer);
    expect(result.text).toBe('"./module.js"');
  });
});
