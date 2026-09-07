#!/usr/bin/env bun
// Runs after `bun run build`: checks the bundles stay lean, then makes
// dist/cli.js executable as a CLI (Bun's bundler adds no shebang).
// TypeScript rather than shell so the hook also runs on Windows, where
// bun's script runner cannot execute .sh files (no shebang mechanism).
import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";

const outfile = "dist/cli.js";
const bundles = [outfile, "dist/runner-sdk.js"];

// Externals that must only ever be reached through a dynamic import(). A static
// import anywhere in src/ becomes a top-level import here, and Node would load
// the whole package on every command start again.
const lazyExternals = ["typescript", "webdriverio"];
// Startup is dominated by parsing the bundle; this catches a heavy dependency
// slipping back in (typescript alone was 9 MB, the webdriver stack 5 MB).
const maxBundleBytes = 2_000_000;

for (const path of bundles) {
  const source = readFileSync(path, "utf8");
  for (const pkg of lazyExternals) {
    if (new RegExp(`^import\\b[^\\n]*"${pkg}"`, "m").test(source)) {
      console.error(
        `${path} imports "${pkg}" at top level; it must stay a dynamic import()`,
      );
      process.exit(1);
    }
  }
  const sizeBytes = statSync(path).size;
  if (sizeBytes > maxBundleBytes) {
    console.error(
      `${path} is ${sizeBytes} bytes, over the ${maxBundleBytes} byte ceiling`,
    );
    process.exit(1);
  }
}

// Prepend the Node.js shebang so the OS knows how to execute the file.
// Skip when one is already present: a repeat run without a rebuild would
// otherwise add a second shebang line, which is a syntax error to Node.
const bundle = readFileSync(outfile);
if (bundle.subarray(0, 2).toString("ascii") !== "#!") {
  writeFileSync(
    outfile,
    Buffer.concat([Buffer.from("#!/usr/bin/env node\n"), bundle]),
  );
}

// Set the executable bit so it can run directly (required by npm link / bin);
// mode | 0o111 mirrors `chmod +x`. No-op on Windows, same as in bash.
chmodSync(outfile, statSync(outfile).mode | 0o111);
