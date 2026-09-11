import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { readJsonFile, writeJsonFileAtomically } from "./jsonFile.js";

const schema = z.object({ id: z.string() });

describe("readJsonFile", () => {
  it("reads a record that fits the schema", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/w", { recursive: true });
    await fs.writeFile("/w/a.json", JSON.stringify({ id: "one" }));

    expect(await readJsonFile(fs, "/w/a.json", schema)).toEqual({ id: "one" });
  });

  it("reads a missing, malformed or wrong-shaped file as absent", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/w", { recursive: true });
    await fs.writeFile("/w/torn.json", '{"id": "on');
    await fs.writeFile("/w/other.json", JSON.stringify({ id: 1 }));

    expect(await readJsonFile(fs, "/w/none.json", schema)).toBeUndefined();
    expect(await readJsonFile(fs, "/w/torn.json", schema)).toBeUndefined();
    expect(await readJsonFile(fs, "/w/other.json", schema)).toBeUndefined();
  });
});

describe("writeJsonFileAtomically", () => {
  it("leaves only the target behind, holding the record", async () => {
    const fs = makeMemoryFs();
    await fs.mkdir("/w", { recursive: true });

    await writeJsonFileAtomically(fs, "/w/a.json", { id: "one" });

    expect(await fs.readdir("/w")).toEqual(["a.json"]);
    expect(await readJsonFile(fs, "/w/a.json", schema)).toEqual({ id: "one" });
  });
});
