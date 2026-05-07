import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { z } from "zod";

import { qawolfConfigSchema, type QawolfConfig } from "./schema.js";

const CONFIG_FILENAME = "qawolf.config.ts";

export type LoadConfigDeps = {
  cwd: () => string;
  fileExists: (path: string) => boolean;
  importConfig: (path: string) => Promise<unknown>;
};

const defaultLoadConfigDeps: LoadConfigDeps = {
  cwd: () => process.cwd(),
  fileExists: existsSync,
  importConfig: async (path): Promise<unknown> =>
    import(pathToFileURL(path).href),
};

export async function loadConfig(
  deps: LoadConfigDeps = defaultLoadConfigDeps,
): Promise<QawolfConfig> {
  const configPath = resolve(deps.cwd(), CONFIG_FILENAME);
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
  return `Invalid ${CONFIG_FILENAME}:\n${lines.join("\n")}`;
}

function formatIssue(issue: z.core.$ZodIssue, input: unknown): string {
  const path = issue.path.length ? issue.path.map(String).join(".") : "(root)";
  const value = readPath(input, issue.path);

  if (issue.code === "invalid_type") {
    return `${path}: expected ${issue.expected}, got ${describeType(value)}`;
  }
  if (issue.code === "invalid_value") {
    const allowed = issue.values.map(formatLiteral).join(" | ");
    return `${path}: must be ${allowed} (got ${formatLiteral(value)})`;
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

function describeType(input: unknown): string {
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  return typeof input;
}

function formatLiteral(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}
