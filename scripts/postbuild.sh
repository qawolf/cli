#!/usr/bin/env bash
# Runs after `bun run build` to make dist/cli.js executable as a CLI.
# Bun's bundler doesn't add a shebang, so we prepend one manually.

set -euo pipefail

OUTFILE="dist/cli.js"

# Prepend the Node.js shebang so the OS knows how to execute the file
printf '#!/usr/bin/env node\n' | cat - "$OUTFILE" > "$OUTFILE.tmp"
mv "$OUTFILE.tmp" "$OUTFILE"

# Set the executable bit so it can run directly (required by npm link / bin)
chmod +x "$OUTFILE"
