// Witness that the shipped CLI spawns its child processes, not a re-bundled
// copy. cmdEscapeSmoke.mjs passes `platform` itself, so it cannot catch a call
// site that forgets to thread it.
//
// Only npm-registry takes the win32 cmd.exe route. A bun install writes
// playwright.exe, so that check exercises the spawn seam but not the escaping.
import { spawnSync } from "node:child_process";

// npm ping reaches the network, so a registry outage must not red the job.
// This detail is the WIZ-11274 signature: the spawn itself failed.
const checks = [
  {
    name: "npm-registry",
    accept: (check) => check.detail !== "npm is not installed or not on PATH",
  },
  { name: "playwright", accept: (check) => check.status === "pass" },
];

const result = spawnSync(
  process.execPath,
  ["dist/cli.js", "doctor", "--json"],
  {
    encoding: "utf8",
  },
);

if (result.error) {
  console.error(`doctor smoke FAILED to launch: ${result.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error(
    `doctor smoke FAILED: output is not JSON\n${result.stdout}\n${result.stderr}`,
  );
  process.exit(1);
}

let failed = 0;

for (const { name, accept } of checks) {
  const check = report.checks?.find((entry) => entry.name === name);
  const ok = check !== undefined && accept(check);
  if (!ok) failed += 1;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name} ${JSON.stringify(check ?? null)}`,
  );
}

if (failed > 0) {
  console.error(`doctor smoke FAILED: ${failed}/${checks.length} checks`);
  process.exit(1);
}

console.log(`doctor smoke OK on ${process.platform}`);
