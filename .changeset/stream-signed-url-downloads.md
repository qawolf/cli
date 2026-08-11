---
"@qawolf/cli": patch
---

Stream signed-URL downloads to disk instead of buffering them in memory. Before this change, the CLI held the whole file in memory and briefly needed about twice the file size, so a multi-gigabyte asset could exceed the memory limit of a small CI container. The download now writes each chunk to a `.part` file and renames it into place when the download completes, so peak memory stays near one chunk for any file size. A pull of a 1.4 GB asset now peaks at about 290 MB of memory instead of 3.3 GB. A failed download removes the partial file, and slow disk writes do not count toward the 30-second stall timeout.
