import type { AnyPublicApiContract } from "@qawolf/api-contracts/v1";

/** Every published contract justifies its hints; a stand-in contract only has to carry them. */
export const standInAnnotationJustifications: AnyPublicApiContract["annotationJustifications"] =
  {
    destructiveHint: "Stand-in contract for a test.",
    openWorldHint: "Stand-in contract for a test.",
    readOnlyHint: "Stand-in contract for a test.",
  };
