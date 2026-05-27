import { describe, expect, it } from "bun:test";
import { flattenErrorChain } from "./formatError.js";

describe("flattenErrorChain", () => {
  it("terminates when err.cause points back to err", () => {
    const err = new Error("self");
    (err as Error & { cause: unknown }).cause = err;
    const chain = flattenErrorChain(err);
    expect(chain.length).toBeLessThan(10);
    expect(chain[0]?.message).toBe("self");
  }, 500);

  it("terminates on two-way cycles between distinct errors", () => {
    const a = new Error("a");
    const b = new Error("b");
    (a as Error & { cause: unknown }).cause = b;
    (b as Error & { cause: unknown }).cause = a;
    const chain = flattenErrorChain(a);
    expect(chain.length).toBeLessThan(10);
    expect(chain[0]?.message).toBe("a");
    expect(chain[1]?.message).toBe("b");
  }, 500);
});
