import { describe, expect, it } from "bun:test";

import { uploadFileName } from "./uploadFileName.js";

describe("uploadFileName", () => {
  it("keeps a name the API accepts as it is", () => {
    expect(uploadFileName("dist/app-release_1.2.apk")).toBe(
      "app-release_1.2.apk",
    );
  });

  it("turns each run of other characters into one dash", () => {
    expect(uploadFileName("/builds/My App (QA).ipa")).toBe("My-App-QA-.ipa");
  });

  it("shortens a long name and keeps its extension", () => {
    const name = uploadFileName(`${"a".repeat(300)}.aab`);

    expect(name).toHaveLength(255);
    expect(name.endsWith("a.aab")).toBe(true);
  });
});
