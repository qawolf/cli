---
"@qawolf/cli": patch
---

Show a per-file counter while `flows pull` downloads team-storage assets. The progress line now reads "Downloading team-storage assets (2/12)" and advances as each file starts. The total counts only files that download; reused and skipped files are not included. In human mode the spinner label updates in place, and when a download fails the error line keeps the last counter so you can see where it stopped. Agent mode writes one progress line per file to stderr. The json output does not change.
