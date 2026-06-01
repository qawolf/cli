export type JUnitFlowRecord = {
  name: string;
  path: string;
  status: "pass" | "fail";
  durationMs: number;
  error?: string;
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toSeconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

function renderTestCase(flow: JUnitFlowRecord): string {
  const attrs = `name="${escapeXml(flow.name)}" classname="${escapeXml(flow.path)}" time="${toSeconds(flow.durationMs)}"`;
  if (flow.status === "pass") {
    return `    <testcase ${attrs}/>`;
  }
  const message =
    flow.error && flow.error.trim() !== ""
      ? flow.error
      : `Flow failed: ${flow.name}`;
  return `    <testcase ${attrs}>
      <failure message="${escapeXml(message)}" type="Error">${escapeXml(message)}</failure>
    </testcase>`;
}

function renderTestSuite(flow: JUnitFlowRecord): string {
  const failures = flow.status === "fail" ? 1 : 0;
  return `  <testsuite name="${escapeXml(flow.name)}" tests="1" failures="${failures}" errors="0" time="${toSeconds(flow.durationMs)}" file="${escapeXml(flow.path)}">
${renderTestCase(flow)}
  </testsuite>`;
}

/**
 * Render run results as JUnit XML. Each flow maps to a `<testsuite>` containing
 * a single `<testcase>` — our runner reports pass/fail per flow, not per
 * assertion, so one testcase per flow is the honest representation.
 */
export function generateJUnit(
  flows: JUnitFlowRecord[],
  runDurationMs: number,
): string {
  const totalTests = flows.length;
  const totalFailures = flows.filter((f) => f.status === "fail").length;
  const suites = flows.map(renderTestSuite).join("\n");
  const body = suites === "" ? "" : `\n${suites}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="QA Wolf" tests="${totalTests}" failures="${totalFailures}" errors="0" time="${toSeconds(runDurationMs)}">${body}
</testsuites>`;
}
