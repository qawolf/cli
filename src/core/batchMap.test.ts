import { describe, expect, it } from "bun:test";
import { batchMap } from "./batchMap.js";

describe("batchMap", () => {
  it("should return empty array when given no items", async () => {
    const result = await batchMap([], async (x: string) => x, 32);
    expect(result).toEqual([]);
  });

  it("should return one result per item when items fit in a single batch", async () => {
    const items = ["a", "b", "c"];
    const result = await batchMap(items, async (x) => x.toUpperCase(), 32);
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("should return all results flat when items exceed one batch", async () => {
    const items = Array.from({ length: 35 }, (_, i) => i);
    const result = await batchMap(items, async (x) => x * 2, 32);
    expect(result).toHaveLength(35);
    expect(result[0]).toBe(0);
    expect(result[34]).toBe(68);
  });

  it("should preserve order across batch boundaries", async () => {
    const items = Array.from({ length: 65 }, (_, i) => i);
    const result = await batchMap(items, async (x) => x, 32);
    expect(result).toHaveLength(65);
    for (let i = 0; i < 65; i++) {
      expect(result[i]).toBe(i);
    }
  });
});
