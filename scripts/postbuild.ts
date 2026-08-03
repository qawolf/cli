#!/usr/bin/env bun
// Runs after `bun run build` to make dist/cli.js executable as a CLI.
// Bun's bundler doesn't add a shebang, so we prepend one manually.
// TypeScript rather than shell so the hook also runs on Windows, where
// bun's script runner cannot execute .sh files (no shebang mechanism).
import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";

const outfile = "dist/cli.js";

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
