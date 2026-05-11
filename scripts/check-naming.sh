#!/usr/bin/env bash
# Rejects SHOUTING_SNAKE_CASE variable declarations in src/. Use camelCase instead.
set -euo pipefail

MATCHES=$(grep -rn --include="*.ts" -E \
  '^\s*(export\s+)?(const|let|var)\s+[A-Z][A-Z_0-9]{2,}(\s*[=:;]|\s)' \
  src/ 2>/dev/null || true)

if [ -n "$MATCHES" ]; then
  echo "error: SHOUTING_SNAKE_CASE variable names are not allowed. Use camelCase instead."
  echo ""
  echo "$MATCHES"
  exit 1
fi
