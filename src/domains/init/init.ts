import { dirname, join, relative } from "node:path";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";
import { initMessages } from "~/core/messages/index.js";
import { ensurePackageJson } from "./ensurePackageJson.js";
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
