import { describe, expect, it } from "bun:test";

import { generateJUnit, type JUnitFlowRecord } from "./junitXml.js";

const sampleFlows: JUnitFlowRecord[] = [
  {
    name: "Login Flow",
    path: "flows/login.ts",
    status: "pass",
    durationMs: 2000,
  },
  {
    name: "Checkout Flow",
    path: "flows/checkout.ts",
    status: "fail",
    durationMs: 3000,
    error: "Element not found: #checkout-button",
  },
];

describe("generateJUnit", () => {
  it("returns XML with declaration and testsuites root", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<testsuites");
    expect(xml).toContain("</testsuites>");
  });

  it("counts one test per flow and reports failures on testsuites", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toMatch(/testsuites[^>]*tests="2"/);
    expect(xml).toMatch(/testsuites[^>]*failures="1"/);
  });

  it("expresses the suite time in seconds", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toMatch(/testsuites[^>]*time="5.000"/);
  });

  it("includes a testsuite per flow with name and file", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toContain('name="Login Flow"');
    expect(xml).toContain('file="flows/login.ts"');
    expect(xml).toContain('name="Checkout Flow"');
    expect(xml).toContain('file="flows/checkout.ts"');
  });

  it("emits one testcase per flow using the flow path as classname", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toContain('classname="flows/login.ts"');
    expect(xml).toContain('classname="flows/checkout.ts"');
  });

  it("expresses each testcase time in seconds", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toContain('time="2.000"');
    expect(xml).toContain('time="3.000"');
  });

  it("self-closes a passed testcase", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toMatch(/<testcase[^>]*name="Login Flow"[^>]*\/>/);
  });

  it("adds a failure element for a failed flow", () => {
    const xml = generateJUnit(sampleFlows, 5000);
    expect(xml).toMatch(
      /<testcase[^>]*name="Checkout Flow"[^/][\s\S]*?<failure/,
    );
    expect(xml).toContain("Element not found: #checkout-button");
  });

  it("escapes XML special characters in names", () => {
    const xml = generateJUnit(
      [{ name: 'Flow <A> & "B"', path: "f.ts", status: "pass", durationMs: 0 }],
      0,
    );
    expect(xml).toContain("Flow &lt;A&gt; &amp; &quot;B&quot;");
    expect(xml).not.toContain("Flow <A>");
  });

  it("escapes XML special characters in error messages", () => {
    const xml = generateJUnit(
      [
        {
          name: "Flow",
          path: "f.ts",
          status: "fail",
          durationMs: 100,
          error: 'Expected <div> to contain "text" & more',
        },
      ],
      100,
    );
    expect(xml).toContain(
      "Expected &lt;div&gt; to contain &quot;text&quot; &amp; more",
    );
  });

  it("falls back to a synthesized message when a failed flow has an empty error", () => {
    const xml = generateJUnit(
      [
        {
          name: "Flow",
          path: "f.ts",
          status: "fail",
          durationMs: 100,
          error: "",
        },
      ],
      100,
    );
    expect(xml).not.toContain('message=""');
    expect(xml).toContain("Flow failed: Flow");
  });

  it("produces an empty suite root when there are no flows", () => {
    const xml = generateJUnit([], 0);
    expect(xml).toMatch(/testsuites[^>]*tests="0"/);
    expect(xml).toMatch(/testsuites[^>]*failures="0"/);
    expect(xml).not.toContain("<testcase");
  });
});
