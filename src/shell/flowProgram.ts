import { join } from "node:path";
import type ts from "typescript";

import { isFlowFile } from "~/core/flowMeta.js";

import { loadTypescript, type TypescriptModule } from "./typescript.js";
import { makeDefaultFs, type Fs } from "./fs.js";

type FlowProgram = {
  readonly compiler: TypescriptModule;
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly flowFiles: readonly ts.SourceFile[];
  readonly isLocalFile: (fileName: string) => boolean;
};

// Pulled bundles need their path aliases, but do not need installed dependencies.
function compilerOptions(
  compiler: TypescriptModule,
  bundleDir: string,
  host: ts.ParseConfigHost,
): ts.CompilerOptions {
  const fallback: ts.CompilerOptions = {
    allowJs: true,
    noEmit: true,
    skipLibCheck: true,
    target: compiler.ScriptTarget.ESNext,
    module: compiler.ModuleKind.ESNext,
    moduleResolution: compiler.ModuleResolutionKind.Bundler,
  };

  const configPath = join(bundleDir, "tsconfig.json");
  const read = compiler.readConfigFile(configPath, (path) =>
    host.readFile(path),
  );
  if (read.error !== undefined || read.config === undefined) return fallback;

  const parsed = compiler.parseJsonConfigFileContent(
    read.config,
    host,
    bundleDir,
  );
  return { ...parsed.options, allowJs: true, noEmit: true, skipLibCheck: true };
}

export async function createFlowProgram(args: {
  bundleDir: string;
  sourcePaths: readonly string[];
  fs?: Fs;
}): Promise<FlowProgram> {
  const compiler = await loadTypescript();
  const fs = args.fs ?? makeDefaultFs();
  const readFile = (path: string): string | undefined => {
    try {
      return fs.readFileSync(path.replaceAll("\\", "/"));
    } catch {
      return undefined;
    }
  };
  const fileExists = (path: string): boolean =>
    fs.existsSync(path.replaceAll("\\", "/"));
  const options = compilerOptions(compiler, args.bundleDir, {
    useCaseSensitiveFileNames: compiler.sys.useCaseSensitiveFileNames,
    readFile,
    fileExists,
    readDirectory: () => [],
  });
  const host = compiler.createCompilerHost(options);
  host.readFile = readFile;
  host.fileExists = fileExists;
  delete host.directoryExists;
  delete host.getDirectories;
  delete host.realpath;
  delete host.readDirectory;
  const program = compiler.createProgram([...args.sourcePaths], options, host);
  const checker = program.getTypeChecker();

  // TypeScript normalizes SourceFile.fileName to forward slashes on Windows.
  const normalize = (fileName: string): string =>
    fileName.replaceAll("\\", "/");
  const local = new Set(args.sourcePaths.map(normalize));
  const isLocalFile = (fileName: string): boolean =>
    local.has(normalize(fileName));
  const sourceFiles = program
    .getSourceFiles()
    .filter((file) => isLocalFile(file.fileName));

  return {
    compiler,
    program,
    checker,
    sourceFiles,
    flowFiles: sourceFiles.filter((file) => isFlowFile(file.fileName)),
    isLocalFile,
  };
}
