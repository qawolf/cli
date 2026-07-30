// Cross-platform witness that the CLI can spawn npm on the host, through the
// REAL shipped resolveNpmCommand + defaultSpawn rather than a copy.
//
// Unit tests take the platform as a parameter, so they pass on Linux whatever
// win32 does. Only a Windows runner reaches CreateProcess. That is where
// WIZ-11274 failed: Windows ships npm.cmd, and libuv's PATH search ignores
// PATHEXT, so a bare "npm" is ENOENT.
//
// bun bundles src/shell/npm.ts and src/shell/spawn.ts into the *.generated.mjs
// files (see the windows-smoke CI job). The bundle step resolves the `~/` path
// alias that Node cannot.
import { resolveNpmCommand } from "./npm.generated.mjs";
import { defaultSpawn } from "./spawn.generated.mjs";

// One platform value picks the command name and the invocation route, which is
// the contract SpawnFn requires.
const platform = process.platform;
const cmd = resolveNpmCommand(platform);
const result = await defaultSpawn(cmd, ["--version"], { platform });

if (result.exitCode !== 0) {
  console.error(
    `npm-spawn smoke FAILED: "${cmd} --version" exited ${result.exitCode}\n${result.stderr}`,
  );
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+/.test(result.stdout.trim())) {
  console.error(
    `npm-spawn smoke FAILED: "${cmd} --version" printed no version: ${JSON.stringify(result.stdout)}`,
  );
  process.exit(1);
}

console.log(
  `npm-spawn smoke OK on ${process.platform}: ${cmd} ${result.stdout.trim()}`,
);
