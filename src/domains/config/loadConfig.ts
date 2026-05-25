import { makeDefaultFs } from "~/shell/fs.js";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { z } from "zod";

import { qawolfConfigSchema, type QawolfConfig } from "./schema.js";

const configFilename = "qawolf.config.ts";

export type LoadConfigDeps = {
  cwd: () => string;
  fileExists: (path: string) => boolean;
  importConfig: (path: string) => Promise<unknown>;
};

const defaultFs = makeDefaultFs();

const defaultLoadConfigDeps: LoadConfigDeps = {
  cwd: () => process.cwd(),
  fileExists: (path) => defaultFs.existsSync(path),
  importConfig: async (path): Promise<unknown> =>
    import(pathToFileURL(path).href),
};

export async function loadConfig(
  deps: LoadConfigDeps = defaultLoadConfigDeps,
): Promise<QawolfConfig> {
  const configPath = resolve(deps.cwd(), configFilename);
  const userConfig = deps.fileExists(configPath)
    ? extractDefaultExport(await deps.importConfig(configPath))
    : {};

  const result = qawolfConfigSchema.safeParse(userConfig);
  if (!result.success) {
    throw new Error(formatConfigError(result.error.issues, userConfig));
  }
  return result.data;
}

function extractDefaultExport(moduleNamespace: unknown): unknown {
  if (
    typeof moduleNamespace === "object" &&
    moduleNamespace !== null &&
    "default" in moduleNamespace
  ) {
    return moduleNamespace.default;
  }
  return moduleNamespace;
}

function formatConfigError(
  issues: readonly z.core.$ZodIssue[],
  input: unknown,
): string {
  const lines = issues
    .map((issue) => formatIssue(issue, input))
    .map((line) => `  - ${line}`);
  return `Invalid ${configFilename}:\n${lines.join("\n")}`;
}

function formatIssue(issue: z.core.$ZodIssue, input: unknown): string {
  const path = issue.path.length ? issue.path.map(String).join(".") : "(root)";
  const value = readPath(input, issue.path);

  if (issue.code === "invalid_type") {
    return `${path}: expected ${issue.expected}, got ${describeValue(value)}`;
  }
  if (issue.code === "invalid_value") {
    const allowed = issue.values.map(describeValue).join(" | ");
    return `${path}: must be ${allowed} (got ${describeValue(value)})`;
  }
  if (issue.code === "unrecognized_keys") {
    return `unknown key(s): ${issue.keys.join(", ")}`;
  }
  return `${path}: ${issue.message}`;
}

function readPath(input: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = input;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    if (!(key in current)) return undefined;
    current = Reflect.get(current, key);
  }
  return current;
}

// Render a value for inclusion in error messages: primitives are shown
// directly (with strings truncated at 60 chars); objects and arrays fall back
// to a type label to avoid leaking large structures or secrets.
function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") {
    const truncated = value.length > 60 ? `${value.slice(0, 60)}...` : value;
    return JSON.stringify(truncated);
  }
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return typeof value;
}
