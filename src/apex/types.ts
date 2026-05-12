import { z } from "zod";

export const environmentWithVariablesResponseSchema = z.object({
  environmentVariables: z.record(z.string(), z.string()),
});
export type EnvironmentWithVariablesResponse = z.infer<
  typeof environmentWithVariablesResponseSchema
>;
export const flowsBundleResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
  url: z.url(),
});
export type FlowsBundleResponse = z.infer<typeof flowsBundleResponseSchema>;
