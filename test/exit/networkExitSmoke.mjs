// Witness that a command whose reply arrives over the network exits with its
// own status code. The CLI used to kill the process the moment the command
// resolved; a reply still being torn down aborted Node on win32 ("Assertion
// failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c") and the
// crash code replaced the command's, so a caller could not tell success from
// an auth or a billing refusal.
//
// The reply has to be large enough to arrive compressed: the API compresses
// replies past about a kilobyte, and only a compressed, chunked body left work
// in flight at the exit. This server mirrors that shape, so the smoke needs no
// API key and reaches no network.
//
// Usage: node test/exit/networkExitSmoke.mjs [command ...args]
//        defaults to the shipped bundle, `node dist/cli.js`.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";

const attempts = 5;
// A command that cannot drain is as broken as one that crashes, and a hung
// child would otherwise stall the job until the runner's own timeout.
const attemptTimeoutMs = 30_000;
const argv = process.argv.slice(2);
const [command, ...leadingArgs] =
  argv.length > 0 ? argv : [process.execPath, "dist/cli.js"];

const tags = Array.from({ length: 40 }, (_, index) => ({
  color: "#4f46e5",
  name: `smoke-tag-${index}`,
  url: "http://127.0.0.1/settings/tags",
}));
const payload = gzipSync(
  Buffer.from(JSON.stringify({ result: { data: { json: { tags } } } })),
);

const server = createServer((_request, response) => {
  // No content-length: a compressed reply arrives chunked.
  response.writeHead(200, {
    "content-encoding": "gzip",
    "content-type": "application/json",
  });
  response.end(payload);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

function runCli() {
  return new Promise((resolve) => {
    const child = spawn(command, [...leadingArgs, "tag", "list", "--json"], {
      env: {
        ...process.env,
        QAWOLF_API_KEY: "smoke-key",
        QAWOLF_HOST_URL: `http://127.0.0.1:${port}`,
        QAWOLF_NO_UPDATE_CHECK: "1",
      },
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
    }, attemptTimeoutMs);
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

const failures = [];
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const result = await runCli();
  if (result.launchError) {
    failures.push(
      `attempt ${attempt} failed to launch: ${result.launchError.message}`,
    );
  } else if (result.timedOut) {
    failures.push(
      `attempt ${attempt} never exited within ${attemptTimeoutMs}ms`,
    );
  } else if (result.status !== 0) {
    failures.push(
      `attempt ${attempt} exited ${result.status} (signal ${result.signal})\n${result.stdout}\n${result.stderr}`,
    );
  } else if (!result.stdout.includes("smoke-tag-39")) {
    failures.push(`attempt ${attempt} printed no tags\n${result.stdout}`);
  }
}

server.close();

if (failures.length > 0) {
  console.error(`network exit smoke FAILED\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(
  `network exit smoke OK on ${process.platform}: ${attempts}/${attempts} exited 0 (${command})`,
);
