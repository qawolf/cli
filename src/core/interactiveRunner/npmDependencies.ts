type NpmDependencies = Record<string, string>;

export type ReadNpmDependencies =
  | { ok: true; dependencies: NpmDependencies }
  | { ok: false; reason: string };

const sectionsInPrecedenceOrder = ["dependencies", "devDependencies"] as const;

// A runner cannot install a workspace range, and @qawolf/flows is already on it.
const isInstallable = (version: string) => !version.startsWith("workspace:");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** What a run installs, read the same way the server derives it. */
export function readNpmDependencies(
  packageJsonContent: string,
): ReadNpmDependencies {
  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJsonContent);
  } catch {
    return { ok: false, reason: "it is not valid JSON" };
  }
  if (!isRecord(parsed)) return { ok: false, reason: "it is not an object" };

  const dependencies: NpmDependencies = {};
  for (const section of sectionsInPrecedenceOrder) {
    const declared = parsed[section];
    if (declared === undefined) continue;
    if (!isRecord(declared)) {
      return { ok: false, reason: `${section} is not an object` };
    }

    for (const [name, version] of Object.entries(declared)) {
      if (typeof version !== "string") {
        return { ok: false, reason: `${section}.${name} is not a string` };
      }
      if (Object.hasOwn(dependencies, name)) continue;
      if (isInstallable(version)) dependencies[name] = version;
    }
  }
  return { dependencies, ok: true };
}
