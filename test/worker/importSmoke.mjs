// Witness that the shipped bundle boots with no node_modules beside it. The
// compiled binary runs every web flow in a worker subprocess that executes
// dist/cli.js from the data directory (src/shell/embeddedWorkerCli.ts), where
// no external package resolves. A package the bundle imports at startup fails
// every flow before it runs, as `@napi-rs/keyring` did in 1.29.0.
//
// The bundle is copied to an empty directory and run with auto-install off.
// With it on, Bun fetches a missing package from the registry, and the smoke
// would pass on a machine with network and fail on one without.
//
// Usage: bun test/worker/importSmoke.mjs [binary]
//        `binary` is a compiled qawolf binary, run the way the worker runs it
//        (BUN_BE_BUN=1). Without it, `bun` from PATH runs the bundle.
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// A bundle that hangs at startup is as broken as one that crashes, and a hung
// child would otherwise stall the job until the runner's own timeout.
const timeoutMs = 30_000;
const binary = process.argv[2];
// Absolute, because the bundle runs from the temporary directory.
const command = binary === undefined ? "bun" : resolve(binary);
const runtimeEnv = binary === undefined ? {} : { BUN_BE_BUN: "1" };
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

const dir = mkdtempSync(join(tmpdir(), "qawolf-worker-smoke-"));
const bundle = join(dir, "cli.js");
copyFileSync("dist/cli.js", bundle);

function runBundle() {
  return new Promise((resolve) => {
    const child = spawn(command, ["--no-install", bundle, "--version"], {
      cwd: dir,
      env: { ...process.env, ...runtimeEnv, QAWOLF_NO_UPDATE_CHECK: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    let timedOut = false;
    const watchdog = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(watchdog);
      resolve({ launchError: error, stderr, stdout });
    });
    child.on("close", (status, signal) => {
      clearTimeout(watchdog);
      resolve({ signal, status, stderr, stdout, timedOut });
    });
  });
}

// A resolution failure lists every path Bun tried; a failing job does not need all of it.
const excerpt = (text) =>
  text.length > 600 ? `${text.slice(0, 600)}… (${text.length} bytes)` : text;

const result = await runBundle();
rmSync(dir, { recursive: true, force: true });

const failure = result.launchError
  ? `failed to launch: ${result.launchError.message}`
  : result.timedOut
    ? `never exited within ${timeoutMs}ms`
    : result.status !== 0
      ? `exited ${result.status} (signal ${result.signal})\n${excerpt(result.stderr)}`
      : result.stdout.trim() !== version
        ? `printed ${JSON.stringify(result.stdout)}, expected version ${version}`
        : undefined;

if (failure !== undefined) {
  console.error(
    `worker bundle import smoke FAILED: ${command} --no-install cli.js --version ${failure}`,
  );
  process.exit(1);
}

console.log(
  `worker bundle import smoke OK on ${process.platform}: dist/cli.js booted with no node_modules (${command})`,
);
