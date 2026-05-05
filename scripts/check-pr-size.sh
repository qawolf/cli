#!/usr/bin/env bash
# Checks that a PR diff does not exceed size thresholds.
# Only added lines are counted; deletions do not increase reviewer burden.
# Generated files and lock files are excluded from the count.
# Usage: check-pr-size.sh <base_ref>
#   base_ref: the branch being merged into (e.g. "main")

set -euo pipefail

BASE_REF="${1:?Usage: check-pr-size.sh <base_ref>}"
WARN_THRESHOLD=250
ERROR_THRESHOLD=400

LINES=$(git diff --numstat "origin/${BASE_REF}...HEAD" \
  -- ':!bun.lock' ':!*.snap' \
  | awk '{sum += $1} END {print sum+0}')

echo "Lines added: ${LINES}"

if [ "${LINES}" -gt "${ERROR_THRESHOLD}" ]; then
  echo "::error::PR diff too large (${LINES} lines added, limit is ${ERROR_THRESHOLD})"
  exit 1
elif [ "${LINES}" -gt "${WARN_THRESHOLD}" ]; then
  echo "::warning::PR diff is large (${LINES} lines added, warning threshold is ${WARN_THRESHOLD})"
fi
