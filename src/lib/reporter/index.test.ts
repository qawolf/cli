import { describe, expect, it } from "bun:test";
import { createCompositeReporter, createConsoleReporter } from "./index.js";
import type { ConsoleDeps, Reporter } from "./index.js";

describe("reporter barrel", () => {
  it("should export createConsoleReporter as a function", () => {
    expect(typeof createConsoleReporter).toBe("function");
  });

  it("should export createCompositeReporter as a function", () => {
    expect(typeof createCompositeReporter).toBe("function");
  });

  it("should createConsoleReporter return a Reporter when given valid deps", () => {
    const deps: ConsoleDeps = {
      stdout: { write: () => {} },
      stderr: { write: () => {} },
    };
    const reporter: Reporter = createConsoleReporter(deps);
    expect(typeof reporter).toBe("object");
  });

  it("should createCompositeReporter return a Reporter when given an empty array", () => {
    const reporter: Reporter = createCompositeReporter([]);
    expect(typeof reporter).toBe("object");
  });
});
