import { dirname, join, relative } from "node:path";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { mkdir, pathExists, readFile, writeFile } from "~/shell/fs.js";
import { exampleFlowTs, qawolfConfigTs, qawolfGitignore } from "./templates.js";

export type InitOpts = {
  readonly yes: boolean;
};

export type InitDeps = {
  readonly cwd: string;
  readonly pathExists: (p: string) => Promise<boolean>;
  readonly readFile: (p: string, encoding: "utf-8") => Promise<string>;
  readonly writeFile: (p: string, content: string) => Promise<void>;
  readonly mkdir: (p: string, opts: { recursive: boolean }) => Promise<void>;
};

export function makeDefaultInitDeps(): InitDeps {
  return {
    cwd: process.cwd(),
    pathExists,
    readFile: (p, enc) => readFile(p, enc),
    writeFile: (p, content) => writeFile(p, content, "utf-8"),
    mkdir: (p, opts) => mkdir(p, opts).then(() => {}),
  };
}

export async function handleInit(
  ctx: CommandContext,
  opts: InitOpts,
  deps: InitDeps = makeDefaultInitDeps(),
): Promise<CommandResult> {
  ctx.ui.gap();
  ctx.ui.intro("QA Wolf");

  const configPath = join(deps.cwd, "qawolf.config.ts");
  const flowPath = join(deps.cwd, "src", "flows", "example.flow.ts");
  const gitignorePath = join(deps.cwd, ".qawolf", ".gitignore");

  await writeWithPrompt(ctx, configPath, qawolfConfigTs, opts.yes, deps);
  await writeWithPrompt(ctx, flowPath, exampleFlowTs, opts.yes, deps);
  await writeWithPrompt(ctx, gitignorePath, qawolfGitignore, opts.yes, deps);
  await mergePackageJsonScript(ctx, opts.yes, deps);

  ctx.ui.outro(
    "Run `qawolf auth login`, then `qawolf flows pull`, then `qawolf flows run`.",
  );
}

async function writeWithPrompt(
  ctx: CommandContext,
  filePath: string,
  content: string,
  yes: boolean,
  deps: InitDeps,
): Promise<void> {
  const relPath = relative(deps.cwd, filePath);

  if (await deps.pathExists(filePath)) {
    const confirmed = await ctx.ui.confirm(`Overwrite ${relPath}?`, {
      yes,
      destructive: true,
    });
    if (!confirmed.ok || !confirmed.value) {
      ctx.ui.info(`Skipped ${relPath}`);
      return;
    }
  }

  await deps.mkdir(dirname(filePath), { recursive: true });
  await deps.writeFile(filePath, content);
  ctx.ui.step(`Created ${relPath}`);
}

async function mergePackageJsonScript(
  ctx: CommandContext,
  yes: boolean,
  deps: InitDeps,
): Promise<void> {
  const pkgPath = join(deps.cwd, "package.json");

  if (!(await deps.pathExists(pkgPath))) return;

  let raw: string;
  try {
    raw = await deps.readFile(pkgPath, "utf-8");
  } catch {
    ctx.ui.warn("Could not read package.json — skipped adding `test:e2e`");
    return;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    ctx.ui.warn("package.json is not valid JSON — skipped adding `test:e2e`");
    return;
  }

  const scripts = (pkg["scripts"] ?? {}) as Record<string, string>;
  if (scripts["test:e2e"]) {
    ctx.ui.warn("package.json already has `test:e2e` — skipped");
    return;
  }

  const confirmed = await ctx.ui.confirm(
    "Add `test:e2e` script to package.json?",
    { yes, destructive: true },
  );
  if (!confirmed.ok || !confirmed.value) {
    ctx.ui.info("Skipped package.json");
    return;
  }

  scripts["test:e2e"] = "qawolf flows run";
  pkg["scripts"] = scripts;

  const trailingNewline = raw.endsWith("\n") ? "\n" : "";
  await deps.writeFile(
    pkgPath,
    JSON.stringify(pkg, undefined, 2) + trailingNewline,
  );
  ctx.ui.step("Updated package.json");
}
