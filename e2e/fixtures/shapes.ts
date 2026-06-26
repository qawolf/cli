import type { RepoShape } from "../harness/types.js";
import {
  bunLock,
  bunSinglePackageJson,
  bunWorkspaceRootPackageJson,
  nativeVersionedPackageJson,
  npmSinglePackageJson,
  npmWorkspaceRootPackageJson,
  pnpmLock,
  pnpmWorkspaceRootPackageJson,
  pnpmWorkspaceYaml,
  workspaceAppPackageJson,
  yarnLock,
  yarnWorkspaceRootPackageJson,
} from "./shapeFiles.js";

// Every shape runs the same flow path relative to its run dir.
const flowArg = "src/flows/smoke/compat-smoke.flow.ts";

export const repoShapes: RepoShape[] = [
  {
    name: "01-empty",
    proves: "flow only, no package.json — runs with nothing to resolve",
    files: [],
    flow: "simpleNav",
    runDir: "",
    flowArg,
  },
  {
    name: "02-npm-single",
    proves: "npm single-package (ESM) — baseline",
    files: [{ path: "package.json", content: npmSinglePackageJson }],
    flow: "simpleNav",
    runDir: "",
    flowArg,
  },
  {
    name: "03-bun-single",
    proves: "single package + bun.lock — bun single",
    files: [
      { path: "package.json", content: bunSinglePackageJson },
      { path: "bun.lock", content: bunLock },
    ],
    flow: "simpleNav",
    runDir: "",
    flowArg,
  },
  {
    name: "04-npm-workspace",
    proves:
      "npm workspace, flow in leaf with no leaf node_modules — originally-reported monorepo failure",
    files: [
      { path: "package.json", content: npmWorkspaceRootPackageJson },
      { path: "packages/app/package.json", content: workspaceAppPackageJson },
    ],
    flow: "simpleNav",
    runDir: "packages/app",
    flowArg,
  },
  {
    name: "05-pnpm-workspace",
    proves: "pnpm workspace (pnpm-workspace.yaml + lock) — pnpm workspace",
    files: [
      { path: "package.json", content: pnpmWorkspaceRootPackageJson },
      { path: "pnpm-workspace.yaml", content: pnpmWorkspaceYaml },
      { path: "pnpm-lock.yaml", content: pnpmLock },
      { path: "packages/app/package.json", content: workspaceAppPackageJson },
    ],
    flow: "simpleNav",
    runDir: "packages/app",
    flowArg,
  },
  {
    name: "06-yarn-workspace",
    proves: "yarn workspace (workspaces + yarn.lock) — yarn workspace",
    files: [
      { path: "package.json", content: yarnWorkspaceRootPackageJson },
      { path: "yarn.lock", content: yarnLock },
      { path: "packages/app/package.json", content: workspaceAppPackageJson },
    ],
    flow: "simpleNav",
    runDir: "packages/app",
    flowArg,
  },
  {
    name: "07-bun-workspace",
    proves: "bun workspace (workspaces + bun.lock) — bun workspace",
    files: [
      { path: "package.json", content: bunWorkspaceRootPackageJson },
      { path: "bun.lock", content: bunLock },
      { path: "packages/app/package.json", content: workspaceAppPackageJson },
    ],
    flow: "simpleNav",
    runDir: "packages/app",
    flowArg,
  },
  {
    name: "08-native-and-versioned-deps",
    proves:
      "declares diff@^8.0.3 + sharp; flow imports FILE_HEADERS_ONLY and runs sharp — inner-hop version-shadowing fix and binary native-module load",
    files: [{ path: "package.json", content: nativeVersionedPackageJson }],
    flow: "nativeAndVersioned",
    runDir: "",
    flowArg,
  },
];
