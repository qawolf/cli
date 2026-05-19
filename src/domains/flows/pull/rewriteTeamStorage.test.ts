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

  it("converts a double-quoted string starting with the prefix to a template literal", () => {
    const src = 'const p = "/home/wolf/team-storage/baldeagle.jpeg";\n';
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(
      "const p = `${process.env.TEAM_STORAGE_DIR}/baldeagle.jpeg`;\n",
    );
    expect(out.rewrites).toBe(1);
  });

  it("converts a single-quoted string starting with the prefix to a template literal", () => {
    const src = "const p = '/home/wolf/team-storage/one.csv';\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(
      "const p = `${process.env.TEAM_STORAGE_DIR}/one.csv`;\n",
    );
    expect(out.rewrites).toBe(1);
  });

  it("rewrites every occurrence in a file regardless of quote style", () => {
    const src =
      "a('/home/wolf/team-storage/one.csv');\n" +
      'b("/home/wolf/team-storage/two.csv");\n' +
      "c(`/home/wolf/team-storage/three.csv`);\n";
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(
      "a(`${process.env.TEAM_STORAGE_DIR}/one.csv`);\n" +
        "b(`${process.env.TEAM_STORAGE_DIR}/two.csv`);\n" +
        "c(`${process.env.TEAM_STORAGE_DIR}/three.csv`);\n",
    );
    expect(out.rewrites).toBe(3);
  });

  it("preserves the trailing-slash-only quoted string used in concatenation", () => {
    const src = 'const p = "/home/wolf/team-storage/" + filename;\n';
    const out = rewriteTeamStorage(src);
    expect(out.source).toBe(
      "const p = `${process.env.TEAM_STORAGE_DIR}/` + filename;\n",
    );
    expect(out.rewrites).toBe(1);
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
