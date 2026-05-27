import { describe, expect, it } from "bun:test";
import { selectReporter } from "./selectReporter.js";

function makeSink() {
  const calls: string[] = [];
  return { write: (str: string) => void calls.push(str), calls };
}

function makeDeps() {
  const stdout = makeSink();
  const stderr = makeSink();
  return { stdout, stderr };
}

describe("selectReporter", () => {
  it("human mode returns a reporter that writes styled text to stdout", () => {
    const deps = makeDeps();
    const r = selectReporter("human", deps);
    r.onFlowStart?.({ name: "F", path: "p" });
    expect(deps.stdout.calls.length).toBeGreaterThan(0);
    expect(deps.stderr.calls).toHaveLength(0);
  });

  it("json mode returns a reporter that writes ND-JSON to stdout only", () => {
    const deps = makeDeps();
    const r = selectReporter("json", deps);
    r.onFlowStart?.({ name: "F", path: "p" });
    expect(deps.stderr.calls).toHaveLength(0);
    const event = JSON.parse(deps.stdout.calls.join("").trim()) as {
      type: string;
    };
    expect(event.type).toBe("flow.start");
  });

  it("agent mode returns a reporter that writes plain text to stderr only", () => {
    const deps = makeDeps();
    const r = selectReporter("agent", deps);
    r.onFlowStart?.({ name: "F", path: "p" });
    expect(deps.stdout.calls).toHaveLength(0);
    expect(deps.stderr.calls.join("")).toContain("F");
  });
});
