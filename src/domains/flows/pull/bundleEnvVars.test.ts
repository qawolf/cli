import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { readManifest } from "~/shell/manifest/io.js";
import { buildManifest } from "./bundle.js";
import { buildBundle } from "./pull.fixtures.js";
import { stageBundle } from "./stage.js";

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-bundle-env-vars-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

const baseArgs = () => ({
  envVarsByFlow: undefined,
  envId: "env-x",
  envSlug: undefined,
  envName: undefined,
  bundleDir: workDir,
  cliFlowsVersion: "0.4.0",
  now: new Date("2026-05-10T12:00:00.000Z"),
  envVarsFetchedAt: undefined,
  wrapperName: undefined,
  qawolfCommittedAt: undefined,
  tags: undefined,
});

const entryFor = (
  manifest: Awaited<ReturnType<typeof buildManifest>>,
  path: string,
) => manifest.flows.find((f) => f.path === path);

async function stage(names: string[]): Promise<void> {
  for (const name of names) {
    const p = join(workDir, name);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, "// flow", "utf8");
  }
}

describe("buildManifest env vars", () => {
  it("leaves both fields unset when no scan was supplied", async () => {
    await stage(["src/flows/a.flow.ts"]);

    const manifest = await buildManifest(baseArgs());

    const entry = entryFor(manifest, "src/flows/a.flow.ts");
    expect(entry?.envVars).toBeUndefined();
    expect(entry?.envVarsMayBeIncomplete).toBeUndefined();
  });

  it("records the scanned names per flow", async () => {
    await stage(["src/flows/a.flow.ts", "src/flows/b.flow.ts"]);

    const manifest = await buildManifest({
      ...baseArgs(),
      envVarsByFlow: new Map([
        [
          "src/flows/a.flow.ts",
          { names: ["ALPHA", "BETA"], mayBeIncomplete: false },
        ],
        ["src/flows/b.flow.ts", { names: [], mayBeIncomplete: true }],
      ]),
    });

    expect(entryFor(manifest, "src/flows/a.flow.ts")?.envVars).toEqual([
      "ALPHA",
      "BETA",
    ]);
    expect(
      entryFor(manifest, "src/flows/b.flow.ts")?.envVarsMayBeIncomplete,
    ).toBe(true);
  });

  it("leaves a flow the scan did not cover unset", async () => {
    await stage(["src/flows/a.flow.ts", "src/flows/b.flow.ts"]);

    const manifest = await buildManifest({
      ...baseArgs(),
      envVarsByFlow: new Map([
        ["src/flows/a.flow.ts", { names: ["ALPHA"], mayBeIncomplete: false }],
      ]),
    });

    expect(entryFor(manifest, "src/flows/b.flow.ts")?.envVars).toBeUndefined();
  });
});

describe("stageBundle env vars", () => {
  const stageArgs = (destDir: string, archive: string) => ({
    tmpArchive: archive,
    destAbs: destDir,
    assetsAbs: join(destDir, "..", "assets"),
    envId: "env-abc",
    envSlug: undefined,
    envName: undefined,
    cliFlowsVersion: "0.4.0",
    now: new Date("2026-05-10T12:00:00.000Z"),
    envVarsFetchedAt: new Date("2026-05-10T12:00:00.000Z"),
    tags: undefined,
  });

  it("writes scanned env vars into the manifest, following imports", async () => {
    const archive = join(workDir, "bundle.tar.gz");
    await buildBundle(archive, {
      flows: [
        {
          name: "src/flows/a.flow.ts",
          data: `import { x } from "../pages/login.js";\nexport default async () => [x(), process.env.LOGIN_USER];`,
        },
        {
          name: "src/pages/login.ts",
          data: `export const x = () => process.env.LOGIN_PW;`,
        },
      ],
    });
    const destDir = join(workDir, "env");

    await stageBundle({
      ...stageArgs(destDir, archive),
      envVars: { LOGIN_USER: "u", LOGIN_PW: "p" },
    });

    const manifest = await readManifest(destDir);
    if (typeof manifest === "string") throw new Error(manifest);
    const entry = manifest.flows.find((f) => f.path === "src/flows/a.flow.ts");
    expect(entry?.envVars).toEqual(["LOGIN_PW", "LOGIN_USER"]);
    expect(entry?.envVarsMayBeIncomplete).toBe(false);
  });

  it("reports variables the environment does not define, counted by flow", async () => {
    const archive = join(workDir, "bundle.tar.gz");
    await buildBundle(archive, {
      flows: [
        {
          name: "src/flows/a.flow.ts",
          data: `export default async () => process.env.MISSING_ONE;`,
        },
        {
          name: "src/flows/b.flow.ts",
          data: `export default async () => [process.env.MISSING_ONE, process.env.PRESENT];`,
        },
      ],
    });
    const destDir = join(workDir, "env");

    const result = await stageBundle({
      ...stageArgs(destDir, archive),
      envVars: { PRESENT: "yes" },
    });

    expect(result.missingEnvVars).toEqual([
      { name: "MISSING_ONE", flowCount: 2 },
    ]);
    expect(result.incompleteFlowCount).toBe(0);
  });

  it("does not report runner-provided variables as missing", async () => {
    const archive = join(workDir, "bundle.tar.gz");
    await buildBundle(archive, {
      flows: [
        {
          name: "src/flows/a.flow.ts",
          data: `export default async () => [process.env.QAWOLF_EXAMPLE_ID, process.env.HOME];`,
        },
      ],
    });
    const destDir = join(workDir, "env");

    const result = await stageBundle({
      ...stageArgs(destDir, archive),
      envVars: {},
    });

    expect(result.missingEnvVars).toEqual([]);
  });

  // Unlike tags, which survive a failed fetch, these are rebuilt from the
  // bundle every time — a variable a flow no longer reads must disappear.
  it("does not carry stale env vars forward from a previous pull", async () => {
    const destDir = join(workDir, "env");
    const first = join(workDir, "first.tar.gz");
    await buildBundle(first, {
      flows: [
        {
          name: "src/flows/a.flow.ts",
          data: `export default async () => process.env.OLD_ONE;`,
        },
      ],
    });
    await stageBundle({ ...stageArgs(destDir, first), envVars: {} });

    const second = join(workDir, "second.tar.gz");
    await buildBundle(second, {
      flows: [
        {
          name: "src/flows/a.flow.ts",
          data: `export default async () => process.env.NEW_ONE;`,
        },
      ],
    });
    await stageBundle({ ...stageArgs(destDir, second), envVars: {} });

    const manifest = await readManifest(destDir);
    if (typeof manifest === "string") throw new Error(manifest);
    expect(
      manifest.flows.find((f) => f.path === "src/flows/a.flow.ts")?.envVars,
    ).toEqual(["NEW_ONE"]);
  });
});
