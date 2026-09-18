import { pluralize } from "~/core/pluralize.js";

import { flowsPullMessages } from "./flowsPull.js";

function copiedValues(values: readonly string[], noun: string): string {
  const [only] = values;
  return values.length === 1 && only !== undefined
    ? only
    : pluralize(values.length, noun);
}

export const flowsMessages = {
  title: "Flows",
  remoteTitle: "Remote Flows",
  flowCount: (count: number) => pluralize(count, "flow"),
  list: {
    remoteRequiresEnv:
      "--remote requires an environment. Pass --env <env> or set QAWOLF_ENVIRONMENT.",
    aiTaskIdRequiresRemote: "--ai-task-id requires --remote",
    draftsRequireRemote: "--include-drafts requires --remote",
    filterFlows: (prefix: string | undefined) =>
      prefix === undefined
        ? "Filter flows by name, path or tag"
        : `Filter the flows in ${prefix} by name, path or tag`,
    filterCount: (matched: number, total: number) =>
      `${String(matched)} of ${pluralize(total, "flow")}`,
    interactiveRequiresTerminal:
      "--interactive needs a terminal. Run it in a terminal, without --json or --agent, and without piping its output.",
    copyPath: "copy path",
    copyId: "copy id",
    copied: (values: readonly string[], noun: string) =>
      `Copied ${copiedValues(values, noun)}`,
    copiedViaTerminal: (values: readonly string[], noun: string) =>
      `Sent ${copiedValues(values, noun)} to your terminal's clipboard`,
    idsLeftOut: (missing: number) =>
      `${pluralize(missing, "flow")} had no id yet and ${missing === 1 ? "was" : "were"} left out`,
    noFlowId: "No flow id yet. Pull this environment again to fetch it.",
    noFlowIdShort: "no id yet",
  },
  selectors: {
    tagsNotCached:
      "No cached tags found. Run 'qawolf flows pull --env <env>' to cache them, or pass --remote to read tags from the platform.",
    tagsUnavailable: (env: string) =>
      `Could not reach the platform and no tags are cached for environment '${env}'. Run 'qawolf flows pull --env ${env}' while online.`,
    usingCachedTags: (fetchedAt: string) =>
      `Could not reach the platform. Using tags cached at ${fetchedAt}; tag names were not validated.`,
    unknownTag: (name: string, suggestion: string | undefined) =>
      suggestion === undefined
        ? `No tag named '${name}' on this team. Run 'qawolf tag list' to see available tags.`
        : `No tag named '${name}' on this team. Did you mean '${suggestion}'?`,
    unknownPulledEnv: (
      name: string,
      pulled: readonly string[],
      suggestion: string | undefined,
    ) => {
      const known =
        pulled.length === 0
          ? "No environments have been pulled yet."
          : `Pulled environments: ${pulled.join(", ")}.`;
      const hint =
        suggestion === undefined ? "" : ` Did you mean '${suggestion}'?`;
      return `No pulled environment named '${name}'.${hint} ${known}`;
    },
    allEnvsWithEnv:
      "--all-envs has no effect with --env: the run is already scoped to that environment.",
    allEnvsWithoutTag:
      "--all-envs has no effect without --tag: a pattern run already includes every environment.",
    chooseEnv: "Which environment should these flows run against?",
    ambiguousEnvs: (labels: readonly string[]) =>
      `The selection matches flows in several pulled environments: ${labels.join(
        ", ",
      )}. Pass --env <name> to choose one, or --all-envs to run every match.`,
    noFlowsSelected: (selectors: {
      readonly tags: readonly string[];
    }): string => `No flows matched tags ${selectors.tags.join(", ")}.`,
  },
  run: {
    requiresEnv:
      "An environment is required. Pass --env <env> or set QAWOLF_ENVIRONMENT.",
  },
  pull: flowsPullMessages,
  ensureDeps: {
    multiPackagePattern: (count: number, listed: string) =>
      `Pattern matches flows from ${count} packages — narrow it to a single package:\n${listed}\n\nHint: pass a pattern scoped to one package, e.g \`qawolf flows run '.qawolf/<env>/**'\`.`,
  },
  dotenv: {
    unparseableLine: (line: string) =>
      `Cannot parse .env line: ${JSON.stringify(line)}`,
  },
} as const;
