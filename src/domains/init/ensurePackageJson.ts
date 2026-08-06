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

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    ctx.ui.warn(initMessages.packageJsonInvalidJson);
    return;
  }

  const scripts = (pkg["scripts"] ?? {}) as Record<string, string>;
  const dependencies = (pkg["dependencies"] ?? {}) as Record<string, string>;
  const devDependencies = (pkg["devDependencies"] ?? {}) as Record<
    string,
    string
  >;

  const needScript = !scripts["test:e2e"];
  // The scaffolded flow and config are ES modules; Node picks their module
  // format from this package.json's "type". `npm init -y` writes an explicit
  // "type": "commonjs" on current npm, so an explicit value does not signal
  // author intent — offer the flip whenever the field is not "module", and
  // warn loudly after changing an explicit value (it re-types every .js
  // file in the package).
  const priorType = pkg["type"];
  const needType = priorType !== "module";
  const needFlowsDep =
    !dependencies["@qawolf/flows"] && !devDependencies["@qawolf/flows"];

  const changes: string[] = [];
  if (needScript) changes.push(initMessages.pkgChanges.script);
  if (needType) changes.push(initMessages.pkgChanges.type);
  if (needFlowsDep) changes.push(initMessages.pkgChanges.flowsDep);

  if (changes.length === 0) {
    ctx.ui.info(initMessages.packageJsonUpToDate);
    return;
  }
  if (!needScript) {
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

  if (needScript) {
    scripts["test:e2e"] = "qawolf flows run";
    pkg["scripts"] = scripts;
  }
  if (needType) pkg["type"] = "module";
  if (needFlowsDep) {
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
