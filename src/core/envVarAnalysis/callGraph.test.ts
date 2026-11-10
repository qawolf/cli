import { describe, expect, it } from "bun:test";

import { analyse } from "./analysis.testUtils.js";

const flow = "src/flows/a.flow.ts";

describe("collectEnvVarsByFlow", () => {
  it("reports what the flow reads itself", async () => {
    const r = await analyse({
      [flow]: `export default async () => {
        const u = process.env.LOGIN_USER;
        const p = process.env["LOGIN_PW"];
        const { EXTRA } = process.env;
        return [u, p, EXTRA];
      };`,
    });
    expect(r.byFlow.get(flow)).toEqual({
      names: ["EXTRA", "LOGIN_PW", "LOGIN_USER"],
      mayBeIncomplete: false,
    });
    await r.cleanup();
  });

  it("follows a call into a helper", async () => {
    const r = await analyse({
      "src/pages/login.ts": `export function login() { return process.env.LOGIN_PW; }`,
      [flow]: `import { login } from "../pages/login.js";
        export default async () => login();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["LOGIN_PW"]);
    await r.cleanup();
  });

  it("ignores a method the flow imports but never calls", async () => {
    const r = await analyse({
      "src/pages/login.ts": `export class LoginPage {
          used() { return process.env.USED; }
          unused() { return process.env.UNUSED; }
        }`,
      [flow]: `import { LoginPage } from "../pages/login.js";
        export default async () => new LoginPage().used();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["USED"]);
    await r.cleanup();
  });

  it("follows the declared return type across a chain", async () => {
    const r = await analyse({
      "src/pages/second.ts": `export class Second { act() { return process.env.SECOND; } }`,
      "src/pages/first.ts": `import { Second } from "./second.js";
        export class First {
          open(): Second { return new Second(); }
          start() { return process.env.FIRST; }
        }`,
      [flow]: `import { First } from "../pages/first.js";
        export default async () => {
          const f = new First();
          f.start();
          f.open().act();
        };`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["FIRST", "SECOND"]);
    await r.cleanup();
  });

  it("terminates on mutual recursion", async () => {
    const r = await analyse({
      "src/pages/a.ts": `import { b } from "./b.js";
        export function a(): unknown { return process.env.A ?? b(); }`,
      "src/pages/b.ts": `import { a } from "./a.js";
        export function b(): unknown { return process.env.B ?? a(); }`,
      [flow]: `import { a } from "../pages/a.js";
        export default async () => a();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["A", "B"]);
    await r.cleanup();
  });

  it("attributes only construction for a bare new", async () => {
    const r = await analyse({
      "src/pages/p.ts": `export class P {
          value = process.env.INITIALISER;
          constructor() { void process.env.CONSTRUCTED; }
          later() { return process.env.LATER; }
        }`,
      [flow]: `import { P } from "../pages/p.js";
        export default async () => new P();`,
    });
    const names = r.byFlow.get(flow)?.names ?? [];
    expect(names).toContain("CONSTRUCTED");
    expect(names).toContain("INITIALISER");
    expect(names).not.toContain("LATER");
    await r.cleanup();
  });

  // TypeScript makes up the constructor of a class that declares none, and
  // that signature points at no declaration.
  it("counts the initialisers of a class with no constructor", async () => {
    const r = await analyse({
      "src/pages/p.ts": `export class P {
          readonly base = process.env.BASE_URL;
          go() { return process.env.GO; }
        }`,
      [flow]: `import { P } from "../pages/p.js";
        export default async () => new P().go();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["BASE_URL", "GO"]);
    await r.cleanup();
  });

  // A subclass with no constructor gets its base class's, so the signature
  // names the base class and the subclass's own initialisers were lost.
  it("counts a subclass with no constructor, and its base class", async () => {
    const r = await analyse({
      "src/pages/p.ts": `export class B {
          b = process.env.B_FIELD;
          constructor() { void process.env.B_CTOR; }
        }
        export class D extends B { d = process.env.D_FIELD; }`,
      [flow]: `import { D } from "../pages/p.js";
        export default async () => new D();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["B_CTOR", "B_FIELD", "D_FIELD"]);
    await r.cleanup();
  });

  it("follows super() to a base class with no constructor", async () => {
    const r = await analyse({
      "src/pages/p.ts": `export class B { b = process.env.B_FIELD; }
        export class D extends B {
          d = process.env.D_FIELD;
          constructor() { super(); }
        }`,
      [flow]: `import { D } from "../pages/p.js";
        export default async () => new D();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["B_FIELD", "D_FIELD"]);
    await r.cleanup();
  });

  it("builds every class up a chain of base classes", async () => {
    const r = await analyse({
      "src/pages/p.ts": `export class A { a = process.env.A_FIELD; }
        export class B extends A {}
        export class C extends B { c = process.env.C_FIELD; }`,
      [flow]: `import { C } from "../pages/p.js";
        export default async () => new C();`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["A_FIELD", "C_FIELD"]);
    await r.cleanup();
  });

  it("flags a rest binding of process.env instead of naming it", async () => {
    const r = await analyse({
      [flow]: `const { KNOWN, ...rest } = process.env;
        export default async () => [KNOWN, rest];`,
    });
    expect(r.byFlow.get(flow)).toEqual({
      names: ["KNOWN"],
      mayBeIncomplete: true,
    });
    await r.cleanup();
  });

  it("does not read a name out of a comment", async () => {
    const r = await analyse({
      [flow]: `export default async () => {
        // reads process.env.FROM_COMMENT when configured
        /** @example process.env.FROM_JSDOC */
        return process.env.REAL;
      };`,
    });
    expect(r.byFlow.get(flow)?.names).toEqual(["REAL"]);
    await r.cleanup();
  });

  it("flags a key assembled at runtime", async () => {
    const r = await analyse({
      [flow]:
        "export default async (id: string) => process.env[`${id}_EMAIL`];",
    });
    expect(r.byFlow.get(flow)).toEqual({ names: [], mayBeIncomplete: true });
    await r.cleanup();
  });

  it("reports resolvable names alongside an unresolvable one", async () => {
    const r = await analyse({
      [flow]: `export default async (k: string) => [
        process.env.KNOWN, process.env[k],
      ];`,
    });
    expect(r.byFlow.get(flow)).toEqual({
      names: ["KNOWN"],
      mayBeIncomplete: true,
    });
    await r.cleanup();
  });

  it("keeps flows independent", async () => {
    const r = await analyse({
      "src/flows/a.flow.ts": `export default async () => process.env.ALPHA;`,
      "src/flows/b.flow.ts": `export default async () => process.env.BETA;`,
    });
    expect(r.byFlow.get("src/flows/a.flow.ts")?.names).toEqual(["ALPHA"]);
    expect(r.byFlow.get("src/flows/b.flow.ts")?.names).toEqual(["BETA"]);
    await r.cleanup();
  });
});
