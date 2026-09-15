import type { Entry } from "@napi-rs/keyring";

export type EntryClass = typeof Entry;

/**
 * The native keyring addon, loaded on first use rather than at startup.
 *
 * `@napi-rs/keyring` stays external to the npm bundle (scripts/build.ts), and
 * the compiled binary's worker subprocess runs that bundle from a directory
 * with no node_modules. A static import failed there before any command ran.
 * A lazy one fails only when a credential store is read or written, and every
 * store treats that the way it treats a keychain it cannot open.
 */
export function loadEntryClass(): Promise<EntryClass> {
  return import("@napi-rs/keyring").then((keyring) => keyring.Entry);
}
