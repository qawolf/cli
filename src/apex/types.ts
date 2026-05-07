import { z } from "zod";

export const environmentWithVariablesResponseSchema = z.object({
  environmentVariables: z.record(z.string(), z.string()),
});
export type EnvironmentWithVariablesResponse = z.infer<
  typeof environmentWithVariablesResponseSchema
>;
