import type {
  AnyPublicApiContract,
  PublicApiContractKind,
} from "@qawolf/api-contracts/v1";

import { buildFlagSpecs, type FlagSpec } from "~/core/publicApi/flagSpecs.js";

// Router-shaped tree of public API contracts, mirroring the (unexported)
// router type in @qawolf/api-contracts.
export type ContractTree = {
  [namespaceOrEndpoint: string]: AnyPublicApiContract | ContractTree;
};

export type CommandSpec = {
  // CLI command path, e.g. ["run", "create"] for `qawolf run create`.
  commandPath: string[];
  // Full tRPC procedure path; public contracts mount under `public`.
  trpcPath: string;
  kind: PublicApiContractKind;
  description: string;
  flags: FlagSpec[];
  contract: AnyPublicApiContract;
};

function isContract(
  value: AnyPublicApiContract | ContractTree,
): value is AnyPublicApiContract {
  return "name" in value && typeof value.name === "string";
}

function buildSpec(
  contract: AnyPublicApiContract,
  path: string[],
): CommandSpec {
  const dottedPath = path.join(".");
  if (contract.name !== dottedPath) {
    throw new Error(
      `Contract at "${dottedPath}" declares name "${contract.name}"; names must match their position in the contract tree.`,
    );
  }

  const flags = buildFlagSpecs(contract.input);
  if (!flags.ok) {
    throw new Error(
      `Contract "${contract.name}" field "${flags.field}" cannot be mapped to a CLI flag: ${flags.reason}`,
    );
  }

  return {
    commandPath: path,
    trpcPath: `public.${contract.name}`,
    kind: contract.kind,
    description: contract.description,
    flags: flags.flags,
    contract,
  };
}

export function buildCommandSpecs(tree: ContractTree): CommandSpec[] {
  const walk = (node: ContractTree, path: string[]): CommandSpec[] =>
    Object.entries(node).flatMap(([key, value]) =>
      isContract(value)
        ? [buildSpec(value, [...path, key])]
        : walk(value, [...path, key]),
    );
  return walk(tree, []);
}
