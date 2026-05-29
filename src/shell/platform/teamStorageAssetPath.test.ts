import { describe, expect, it } from "bun:test";

import { safeAssetPath } from "./teamStorageAssetPath.js";

describe("safeAssetPath", () => {
  it("rejects unsupported path forms", () => {
    expect(safeAssetPath("bad\0name.txt")).toBeUndefined();
    expect(safeAssetPath("ovpn/readme.txt")).toBeUndefined();
  });
});
