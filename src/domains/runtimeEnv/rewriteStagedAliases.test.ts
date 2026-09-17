import { describe, expect, it } from "bun:test";
import { posix } from "node:path";

import { type Fs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { rewriteStagedAliases } from "./rewriteStagedAliases.js";

const execDir = "/run/exec";

const aliasTsconfig = JSON.stringify({
  compilerOptions: { paths: { "@utilities/*": ["src/utilities/*"] } },
});

async function stage(tree: Record<string, string>): Promise<Fs> {
  const fs = makeMemoryFs();
  for (const [path, content] of Object.entries(tree)) {
    const absolute = posix.join(execDir, path);
    await fs.mkdir(posix.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content);
  }
  return fs;
}

describe("rewriteStagedAliases", () => {
  it("rewrites an alias import in every staged file that uses one", async () => {
    const fs = await stage({
      "src/flows/checkout.flow.ts": 'import { ask } from "@utilities/gpt.ts";',
      "src/pages/admin.ts": 'import { ask } from "@utilities/gpt.ts";',
      "src/utilities/gpt.ts": "export const ask = 1;",
      "tsconfig.json": aliasTsconfig,
    });

    expect(await rewriteStagedAliases({ execDir, fs })).toEqual([
      "src/flows/checkout.flow.ts",
      "src/pages/admin.ts",
    ]);
    expect(await fs.readFile(`${execDir}/src/flows/checkout.flow.ts`)).toBe(
      'import { ask } from "../utilities/gpt.ts";',
    );
    expect(await fs.readFile(`${execDir}/src/pages/admin.ts`)).toBe(
      'import { ask } from "../utilities/gpt.ts";',
    );
  });

  it("leaves the tree alone when no tsconfig was staged", async () => {
    const fs = await stage({
      "src/flows/checkout.flow.ts": 'import { ask } from "@utilities/gpt.ts";',
      "src/utilities/gpt.ts": "export const ask = 1;",
    });

    expect(await rewriteStagedAliases({ execDir, fs })).toEqual([]);
    expect(await fs.readFile(`${execDir}/src/flows/checkout.flow.ts`)).toBe(
      'import { ask } from "@utilities/gpt.ts";',
    );
  });

  it("leaves the tree alone for a tsconfig declaring no paths", async () => {
    const fs = await stage({
      "src/flows/checkout.flow.ts": 'import { ask } from "@utilities/gpt.ts";',
      "tsconfig.json": '{"compilerOptions":{"strict":true}}',
    });

    expect(await rewriteStagedAliases({ execDir, fs })).toEqual([]);
  });

  it("reports a tsconfig that does not parse rather than silently resolving nothing", async () => {
    const fs = await stage({
      "src/flows/checkout.flow.ts": 'import { ask } from "@utilities/gpt.ts";',
      "tsconfig.json": '{"compilerOptions":{"paths":{}} // trailing comment',
    });
    let reported = 0;

    expect(
      await rewriteStagedAliases({
        execDir,
        fs,
        onTsconfigUnparsed: () => {
          reported += 1;
        },
      }),
    ).toEqual([]);
    expect(reported).toBe(1);
  });

  it("stays quiet when the project declares no paths", async () => {
    const fs = await stage({
      "src/flows/checkout.flow.ts": 'import { ask } from "@utilities/gpt.ts";',
      "tsconfig.json": '{"compilerOptions":{"strict":true}}',
    });
    let reported = 0;

    await rewriteStagedAliases({
      execDir,
      fs,
      onTsconfigUnparsed: () => {
        reported += 1;
      },
    });
    expect(reported).toBe(0);
  });

  it("stays quiet when the project staged no tsconfig at all", async () => {
    const fs = await stage({
      "src/flows/checkout.flow.ts": 'import { ask } from "@utilities/gpt.ts";',
    });
    let reported = 0;

    await rewriteStagedAliases({
      execDir,
      fs,
      onTsconfigUnparsed: () => {
        reported += 1;
      },
    });
    expect(reported).toBe(0);
  });

  it("leaves a file mentioning no alias untouched", async () => {
    const source = 'import { expect } from "playwright";';
    const fs = await stage({
      "src/flows/checkout.flow.ts": source,
      "tsconfig.json": aliasTsconfig,
    });

    expect(await rewriteStagedAliases({ execDir, fs })).toEqual([]);
    expect(await fs.readFile(`${execDir}/src/flows/checkout.flow.ts`)).toBe(
      source,
    );
  });

  it("does not descend into node_modules", async () => {
    const vendored = 'import { ask } from "@utilities/gpt.ts";';
    const fs = await stage({
      "node_modules/vendor/index.ts": vendored,
      "src/utilities/gpt.ts": "export const ask = 1;",
      "tsconfig.json": aliasTsconfig,
    });

    expect(await rewriteStagedAliases({ execDir, fs })).toEqual([]);
    expect(await fs.readFile(`${execDir}/node_modules/vendor/index.ts`)).toBe(
      vendored,
    );
  });

  it("leaves an alias resolving to no staged file alone", async () => {
    const source = 'import { ask } from "@utilities/missing.ts";';
    const fs = await stage({
      "src/flows/checkout.flow.ts": source,
      "tsconfig.json": aliasTsconfig,
    });

    expect(await rewriteStagedAliases({ execDir, fs })).toEqual([]);
    expect(await fs.readFile(`${execDir}/src/flows/checkout.flow.ts`)).toBe(
      source,
    );
  });
});
