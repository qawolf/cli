import { join } from "node:path";
import type { CommandContext } from "~/shell/commandContext.js";
import { flowsVersion } from "~/generated/dependencyVersions.js";
import { initMessages } from "~/core/messages/index.js";

import type { InitDeps } from "./init.js";

export async function ensurePackageJson(
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    ctx.ui.warn(initMessages.packageJsonInvalidJson);
    return;
  }
  // JSON.parse also accepts null, arrays, and primitives — none of which can
  // safely take property assignments (or keep them through stringify).
  if (!isRecord(parsed)) {
    ctx.ui.warn(initMessages.packageJsonNotAnObject);
    return;
  }
  const pkg = parsed;

  // A section that exists but is not an object cannot be repaired without
  // destroying whatever the user put there; skip only that repair.
  const scripts = readSection(ctx, pkg, "scripts");
  const dependencies = readSection(ctx, pkg, "dependencies");
  const devDependencies = readSection(ctx, pkg, "devDependencies");

  const needScript = scripts !== undefined && !scripts["test:e2e"];
  // The scaffolded flow and config are ES modules; Node picks their module
  // format from this package.json's "type". `npm init -y` writes an explicit
  // "type": "commonjs" on current npm, so an explicit value does not signal
  // author intent — offer the flip whenever the field is not "module", and
  // warn loudly after changing an explicit value (it re-types every .js
  // file in the package).
  const priorType = pkg["type"];
  const needType = priorType !== "module";
  const needFlowsDep =
    dependencies !== undefined &&
    !dependencies["@qawolf/flows"] &&
    !devDependencies?.["@qawolf/flows"];

  const changes: string[] = [];
  if (needScript) changes.push(initMessages.pkgChanges.script);
  if (needType) changes.push(initMessages.pkgChanges.type);
  if (needFlowsDep) changes.push(initMessages.pkgChanges.flowsDep);

  if (changes.length === 0) {
    ctx.ui.info(initMessages.packageJsonUpToDate);
    return;
  }
  if (scripts !== undefined && scripts["test:e2e"]) {
    ctx.ui.warn(initMessages.packageJsonHasTestE2e);
  }

  const confirmed = await ctx.ui.confirm(
    initMessages.updatePackageJsonPrompt(changes),
    { yes, destructive: true },
  );
  if (!confirmed.ok || !confirmed.value) {
    ctx.ui.info(initMessages.skippedUpdatingPackageJson);
    return;
  }

  if (needScript && scripts !== undefined) {
    scripts["test:e2e"] = "qawolf flows run";
    pkg["scripts"] = scripts;
  }
  if (needType) pkg["type"] = "module";
  if (needFlowsDep && dependencies !== undefined) {
    dependencies["@qawolf/flows"] = flowsVersion;
    pkg["dependencies"] = dependencies;
  }

  const trailingNewline = raw.endsWith("\n") ? "\n" : "";
  await deps.fs.writeFile(
    pkgPath,
    JSON.stringify(pkg, undefined, 2) + trailingNewline,
  );
  ctx.ui.step(initMessages.updatedPackageJson);
  if (needType && priorType !== undefined) {
    const label =
      typeof priorType === "string" ? priorType : JSON.stringify(priorType);
    ctx.ui.warn(initMessages.typeChanged(label));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a package.json section as a mutable record. Absent sections come back
 * as an empty record (repairable); malformed ones come back undefined after a
 * warning, so their repairs are skipped rather than destroying user data.
 */
function readSection(
  ctx: CommandContext,
  pkg: Record<string, unknown>,
  key: "scripts" | "dependencies" | "devDependencies",
): Record<string, unknown> | undefined {
  const value = pkg[key];
  if (value === undefined) return {};
  if (isRecord(value)) return value;
  ctx.ui.warn(initMessages.packageJsonMalformedSection(key));
  return undefined;
}
