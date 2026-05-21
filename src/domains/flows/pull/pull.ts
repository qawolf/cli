import { readManifest } from "~/shell/manifest/io.js";
import { promptOverwriteIfModified } from "./safety.js";

const envIdPattern =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[a-z][a-z0-9-]{0,62}[a-z0-9])$/;

type ValidateEnvIdResult = "ok" | { error: string };

export function validateEnvId(envId: string): ValidateEnvIdResult {
  if (!envIdPattern.test(envId)) {
    return {
      error: `--env must be a UUID or kebab-case slug (got: ${envId})`,
    };
  }
  return "ok";
}

type CheckSafetyArgs = {
  envDir: string;
  yes: boolean;
  interactive?: boolean | undefined;
  log: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

export async function checkSafety(
  args: CheckSafetyArgs,
): Promise<"proceed" | "abort" | "needs-yes"> {
  const existing = await readManifest(args.envDir);
  if (existing === "missing") return "proceed";
  if (existing === "malformed") {
    args.log(
      "Existing .manifest.json is unreadable; proceeding without local-modification check.",
    );
    return "proceed";
  }
  return promptOverwriteIfModified({ ...args, manifest: existing });
}
