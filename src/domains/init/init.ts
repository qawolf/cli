import { dirname, join, relative } from "node:path";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";
import { flowsVersion } from "~/generated/dependencyVersions.js";
import { initMessages } from "~/core/messages/index.js";
import { exampleFlowTs, qawolfConfigTs, qawolfGitignore } from "./templates.js";

export type InitOpts = {
  readonly yes: boolean;
};

export type InitDeps = {
  readonly cwd: string;
  readonly fs: Fs;
};

export function makeDefaultInitDeps(): InitDeps {
  return {
    cwd: process.cwd(),
    fs: makeDefaultFs(),
  };
}

export async function handleInit(
  ctx: CommandContext,
  opts: InitOpts,
  deps: InitDeps = makeDefaultInitDeps(),
): Promise<CommandResult> {
  ctx.ui.gap();
  ctx.ui.intro(initMessages.title);

  const configPath = join(deps.cwd, "qawolf.config.ts");
  const flowPath = join(deps.cwd, "src", "flows", "example.flow.ts");
  const gitignorePath = join(deps.cwd, ".qawolf", ".gitignore");

  await writeWithPrompt(ctx, configPath, qawolfConfigTs, opts.yes, deps);
  await writeWithPrompt(ctx, flowPath, exampleFlowTs, opts.yes, deps);
  await writeWithPrompt(ctx, gitignorePath, qawolfGitignore, opts.yes, deps);
  await ensurePackageJson(ctx, opts.yes, deps);

  ctx.ui.outro(initMessages.outro);
}

async function writeWithPrompt(
  ctx: CommandContext,
  filePath: string,
  content: string,
  yes: boolean,
  deps: InitDeps,
): Promise<void> {
  const relPath = relative(deps.cwd, filePath);

  if (await deps.fs.pathExists(filePath)) {
    const confirmed = await ctx.ui.confirm(
      initMessages.overwritePrompt(relPath),
      {
        yes,
        destructive: true,
      },
    );
    if (!confirmed.ok || !confirmed.value) {
      ctx.ui.info(initMessages.skippedFile(relPath));
      return;
    }
  }

  await deps.fs.mkdir(dirname(filePath), { recursive: true });
  await deps.fs.writeFile(filePath, content);
  ctx.ui.step(initMessages.createdFile(relPath));
}

async function ensurePackageJson(
  ctx: CommandContext,
  yes: boolean,
  deps: InitDeps,
): Promise<void> {
  const pkgPath = join(deps.cwd, "package.json");

  if (!(await deps.fs.pathExists(pkgPath))) {
    const confirmed = await ctx.ui.confirm(
      initMessages.createPackageJsonPrompt,
      { yes },
    );
    if (!confirmed.ok || !confirmed.value) {
      ctx.ui.info(initMessages.skippedCreatingPackageJson);
      return;
    }
    const pkg = {
      private: true,
      type: "module",
      dependencies: { "@qawolf/flows": flowsVersion },
      scripts: { "test:e2e": "qawolf flows run" },
    };
    await deps.fs.writeFile(pkgPath, JSON.stringify(pkg, undefined, 2) + "\n");
    ctx.ui.step(initMessages.createdPackageJson);
    return;
  }

  const raw = await deps.fs.readFile(pkgPath);

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    ctx.ui.warn(initMessages.packageJsonInvalidJson);
    return;
  }

  const scripts = (pkg["scripts"] ?? {}) as Record<string, string>;
  if (scripts["test:e2e"]) {
    ctx.ui.warn(initMessages.packageJsonHasTestE2e);
    return;
  }

  const confirmed = await ctx.ui.confirm(initMessages.addTestE2ePrompt, {
    yes,
    destructive: true,
  });
  if (!confirmed.ok || !confirmed.value) {
    ctx.ui.info(initMessages.skippedAddingTestE2e);
    return;
  }

  scripts["test:e2e"] = "qawolf flows run";
  pkg["scripts"] = scripts;

  const trailingNewline = raw.endsWith("\n") ? "\n" : "";
  await deps.fs.writeFile(
    pkgPath,
    JSON.stringify(pkg, undefined, 2) + trailingNewline,
  );
  ctx.ui.step(initMessages.updatedPackageJson);
}
