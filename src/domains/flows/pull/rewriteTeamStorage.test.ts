import { describe, expect, it } from "bun:test";

import { rewriteTeamStorage } from "./rewriteTeamStorage.js";

describe("rewriteTeamStorage", () => {
  it("leaves env-var-shaped references unchanged", () => {
    const src =
      "const p = `${process.env.TEAM_STORAGE_DIR}/${FILE_NAME}.fig`;\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(src);
    expect(out.rewrites).toBe(0);
  });

  it("replaces a literal runner mount path with the env-var form", () => {
    const src =
      "await chooser.setFiles(`/home/wolf/team-storage/${dataset}`);\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(
      "await chooser.setFiles(`${process.env.TEAM_STORAGE_DIR}/${dataset}`);\n",
    );
    expect(out.rewrites).toBe(1);
  });

  it("returns the input unchanged when no references are present", () => {
    const src = "const x = 1;\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(src);
    expect(out.rewrites).toBe(0);
  });

  it("rewrites every occurrence in a file", () => {
    const src =
      "a('/home/wolf/team-storage/one.csv');\n" +
      "b('/home/wolf/team-storage/two.csv');\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(
      "a('${process.env.TEAM_STORAGE_DIR}/one.csv');\n" +
        "b('${process.env.TEAM_STORAGE_DIR}/two.csv');\n",
    );
    expect(out.rewrites).toBe(2);
  });

  it("rewrites only the literal-prefix shape in a mixed file", () => {
    const src =
      "const a = `${process.env.TEAM_STORAGE_DIR}/x.fig`;\n" +
      "const b = `/home/wolf/team-storage/y.csv`;\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(
      "const a = `${process.env.TEAM_STORAGE_DIR}/x.fig`;\n" +
        "const b = `${process.env.TEAM_STORAGE_DIR}/y.csv`;\n",
    );
    expect(out.rewrites).toBe(1);
  });

  it("does not rewrite the prefix without a trailing slash", () => {
    const src = "// path: /home/wolf/team-storage (no slash)\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(src);
    expect(out.rewrites).toBe(0);
  });
});
