import type ts from "typescript";

export type TypescriptModule = typeof ts;

// External to the bundle and lazy so unrelated commands never parse the compiler.
// CommonJS interop exposes it on `default` in some runtimes, directly in others.
export async function loadTypescript(): Promise<TypescriptModule> {
  const loaded: unknown = await import("typescript");
  const withDefault = loaded as { default?: unknown };
  const candidate =
    withDefault.default !== undefined ? withDefault.default : loaded;
  const compiler = candidate as TypescriptModule;
  if (typeof compiler.createProgram !== "function") {
    throw new Error(
      "The installed typescript package did not expose createProgram. " +
        "Reinstall dependencies, or report this at https://github.com/qawolf/cli/issues",
    );
  }
  return compiler;
}
