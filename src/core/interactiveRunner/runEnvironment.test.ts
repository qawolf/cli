import { describe, expect, it } from "bun:test";

import { buildRunEnvironment } from "./runEnvironment.js";

describe("buildRunEnvironment", () => {
  it("reads the dotenv format qawolf flows pull writes", () => {
    expect(buildRunEnvironment('BASE_URL="https://example.com"\n')).toEqual({
      environment: { BASE_URL: "https://example.com" },
      ok: true,
    });
  });

  it("reads an empty file as an empty environment", () => {
    expect(buildRunEnvironment("")).toEqual({ environment: {}, ok: true });
  });

  it("names the line it cannot parse", () => {
    const built = buildRunEnvironment("BASE_URL=no-quotes\n");

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("BASE_URL=no-quotes");
  });

  it("refuses a name a shell would not accept", () => {
    expect(buildRunEnvironment('"1BAD"="x"\n').ok).toBe(false);
    expect(buildRunEnvironment('"has-dash"="x"\n').ok).toBe(false);
  });

  // The server stamps it from the key the request authenticated with.
  it("refuses the reserved name in any case", () => {
    for (const name of ["QAWOLF_TEAM_ID", "qawolf_team_id"]) {
      const built = buildRunEnvironment(`${name}="t"\n`);

      expect(built.ok).toBe(false);
      if (built.ok) continue;
      expect(built.error).toContain("reserved");
    }
  });

  it("allows other QAWOLF names, which the server no longer refuses", () => {
    expect(buildRunEnvironment('QAWOLF_DEBUG="1"\n').ok).toBe(true);
  });

  it("refuses more variables than a run may carry", () => {
    const many = Array.from(
      { length: 101 },
      (_unused, index) => `VAR_${String(index)}="x"`,
    ).join("\n");

    expect(buildRunEnvironment(`${many}\n`).ok).toBe(false);
  });

  it("refuses a value over the published length", () => {
    const long = "a".repeat(8 * 1024 + 1);

    expect(buildRunEnvironment(`BIG="${long}"\n`).ok).toBe(false);
  });
});
