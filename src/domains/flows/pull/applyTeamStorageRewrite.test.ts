import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { applyTeamStorageRewrite } from "./applyTeamStorageRewrite.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-rewrite-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("applyTeamStorageRewrite", () => {
  it("rewrites the literal mount-path prefix in .ts and .js files", async () => {
    await writeFile(
      join(workDir, "a.flow.ts"),
      "const p = `/home/wolf/team-storage/x.csv`;\n",
      "utf8",
    );
    await mkdir(join(workDir, "utilities"), { recursive: true });
    await writeFile(
      join(workDir, "utilities", "helpers.js"),
      "const q = `/home/wolf/team-storage/y.csv`;\n",
      "utf8",
    );

    await applyTeamStorageRewrite(workDir);

    expect(await readFile(join(workDir, "a.flow.ts"), "utf8")).toBe(
      "const p = `${process.env.TEAM_STORAGE_DIR}/x.csv`;\n",
    );
    expect(
      await readFile(join(workDir, "utilities", "helpers.js"), "utf8"),
    ).toBe("const q = `${process.env.TEAM_STORAGE_DIR}/y.csv`;\n");
  });

  it("preserves mtime on files that do not change", async () => {
    const path = join(workDir, "unchanged.flow.ts");
    await writeFile(path, "const x = 1;\n", "utf8");
    const before = (await stat(path)).mtimeMs;

    // Wait long enough that any accidental write would change mtime visibly.
    await new Promise((r) => setTimeout(r, 25));
    await applyTeamStorageRewrite(workDir);

    const after = (await stat(path)).mtimeMs;
    expect(after).toBe(before);
  });

  it("ignores non-source extensions", async () => {
    const jsonPath = join(workDir, "data.json");
    await writeFile(
      jsonPath,
      `{"path": "/home/wolf/team-storage/x.csv"}\n`,
      "utf8",
    );
    await applyTeamStorageRewrite(workDir);
    expect(await readFile(jsonPath, "utf8")).toBe(
      `{"path": "/home/wolf/team-storage/x.csv"}\n`,
    );
  });

  it("recurses into nested directories", async () => {
    await mkdir(join(workDir, "deep", "nested"), { recursive: true });
    const deep = join(workDir, "deep", "nested", "c.flow.ts");
    await writeFile(deep, "`/home/wolf/team-storage/z.csv`\n", "utf8");

    await applyTeamStorageRewrite(workDir);

    expect(await readFile(deep, "utf8")).toBe(
      "`${process.env.TEAM_STORAGE_DIR}/z.csv`\n",
    );
  });
});
