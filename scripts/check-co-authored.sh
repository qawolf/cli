#!/usr/bin/env bash
# Checks that no commit in the PR contains a Co-Authored-By trailer.
# Usage: check-co-authored.sh <base_ref>
#   base_ref: the branch being merged into (e.g. "main")

set -euo pipefail

BASE_REF="${1:?Usage: check-co-authored.sh <base_ref>}"
FOUND=0

while IFS= read -r sha; do
  if git show -s --format="%B" "$sha" | grep -qi "^Co-Authored-By:"; then
    echo "::error::Commit ${sha} contains a Co-Authored-By trailer."
    FOUND=1
  fi
done < <(git log "origin/${BASE_REF}..HEAD" --format="%H")

if [ "${FOUND}" -eq 1 ]; then
  echo "Amend the listed commits to remove Co-Authored-By lines."
  exit 1
fi

echo "No Co-Authored-By trailers found."
