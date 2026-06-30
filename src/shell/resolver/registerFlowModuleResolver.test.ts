import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  type FlowResolveHook,
  flowResolveHook,
  resolveRegisterHooks,
} from "./registerFlowModuleResolver.js";

type NextResolve = Parameters<FlowResolveHook>[2];
type Context = Parameters<FlowResolveHook>[1];
type CodedError = Error & { code: string };

const fakeContext = {
  conditions: [],
  importAttributes: {},
  parentURL: undefined,
} as unknown as Context;

function makeModuleNotFoundError(specifier: string): CodedError {
  const err = Error(
    `Cannot find module '${specifier}'`,
  ) as unknown as CodedError;
  err.code = "ERR_MODULE_NOT_FOUND";
  return err;
}

afterEach(() => {
  mock.restore();
});

describe("flowResolveHook", () => {
  it("returns the resolution on the first try without attempting a swap", () => {
    const result = { url: "file:///path/to/code-snippets.js" };
    const nextResolve = mock(() => result) as unknown as NextResolve;

    const out = flowResolveHook("./code-snippets.js", fakeContext, nextResolve);

    expect(out).toBe(result);
    expect(nextResolve).toHaveBeenCalledTimes(1);
    expect(nextResolve).toHaveBeenCalledWith("./code-snippets.js", fakeContext);
  });

  it("retries the .js sibling when .ts throws ERR_MODULE_NOT_FOUND", () => {
    const tsErr = makeModuleNotFoundError("./code-snippets.ts");
    const jsResult = { url: "file:///path/to/code-snippets.js" };
    const nextResolve = mock((specifier: string) => {
      if (specifier.endsWith(".ts")) throw tsErr;
      return jsResult;
    }) as unknown as NextResolve;

    const out = flowResolveHook("./code-snippets.ts", fakeContext, nextResolve);

    expect(out).toBe(jsResult);
  });

  it("rethrows non-module-not-found errors without attempting a swap", () => {
    const syntaxErr = Error("Unexpected token") as unknown as CodedError;
    syntaxErr.code = "ERR_SOMETHING_ELSE";
    const nextResolve = mock(() => {
      throw syntaxErr;
    }) as unknown as NextResolve;

    let caught: unknown;
    try {
      flowResolveHook("./foo.ts", fakeContext, nextResolve);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(syntaxErr);
    expect(nextResolve).toHaveBeenCalledTimes(1);
  });

  it("rethrows the original .ts error when the .js swap also fails", () => {
    const tsErr = makeModuleNotFoundError("./missing.ts");
    const jsErr = makeModuleNotFoundError("./missing.js");
    const nextResolve = mock((specifier: string) => {
      if (specifier.endsWith(".ts")) throw tsErr;
      throw jsErr;
    }) as unknown as NextResolve;

    let caught: unknown;
    try {
      flowResolveHook("./missing.ts", fakeContext, nextResolve);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(tsErr);
  });

  it("rethrows original error for specifiers with no swappable extension", () => {
    const err = makeModuleNotFoundError("axios");
    const nextResolve = mock(() => {
      throw err;
    }) as unknown as NextResolve;

    let caught: unknown;
    try {
      flowResolveHook("axios", fakeContext, nextResolve);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(err);
    expect(nextResolve).toHaveBeenCalledTimes(1);
  });
});

describe("resolveRegisterHooks", () => {
  it("finds registerHooks on a function carrier (node:module's default export)", () => {
    // node:module's default export is the Module function, not a plain object.
    const moduleFn = (() => undefined) as unknown as Record<string, unknown>;
    const registerHooks = (): void => undefined;
    moduleFn["registerHooks"] = registerHooks;

    expect(resolveRegisterHooks(moduleFn)).toBe(registerHooks);
  });

  it("finds registerHooks on an object carrier", () => {
    const registerHooks = (): void => undefined;
    expect(resolveRegisterHooks({ registerHooks })).toBe(registerHooks);
  });

  it("returns undefined when registerHooks is absent (Bun / Node < 22.15)", () => {
    expect(resolveRegisterHooks({})).toBeUndefined();
    expect(resolveRegisterHooks(() => undefined)).toBeUndefined();
  });

  it("returns undefined for nullish or primitive module values", () => {
    expect(resolveRegisterHooks(undefined)).toBeUndefined();
    expect(resolveRegisterHooks(42)).toBeUndefined();
  });
});
