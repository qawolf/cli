import { pathToFileURL } from "node:url";

/** Dynamically imports the module at an absolute filesystem path. */
export function importFromPath(absPath: string): Promise<unknown> {
  // import() takes a URL, not a path. POSIX paths happen to parse as URL
  // paths, but a Windows path ("C:\...") parses as URL protocol "c:", which
  // the Node ESM loader rejects (WIZ-11313).
  return import(pathToFileURL(absPath).href);
}
