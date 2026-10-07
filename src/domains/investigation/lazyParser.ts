import type { InvestigationRequest, InvestigationResult } from "./types.js";

type InvestigationParser = {
  investigate(request: InvestigationRequest): Promise<InvestigationResult>;
};

let parserPromise: Promise<InvestigationParser> | undefined;

export function loadInvestigationParser(): Promise<InvestigationParser> {
  parserPromise ??= import(parserSpecifier()) as Promise<InvestigationParser>;
  return parserPromise;
}

function parserSpecifier(): string {
  const embedded = (globalThis as { qawolfInvestigationParserPath?: string })
    .qawolfInvestigationParserPath;
  if (embedded) return embedded;
  const sourceModule = import.meta.url.includes("/src/domains/investigation/");
  return new URL(
    sourceModule ? "./parser/index.ts" : "./investigation-parser.js",
    import.meta.url,
  ).href;
}
