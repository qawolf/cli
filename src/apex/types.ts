import { z } from "zod";

export const environmentListItemSchema = z.object({
  envId: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type EnvironmentListItem = z.infer<typeof environmentListItemSchema>;

export const environmentWithVariablesResponseSchema = z.object({
  environmentVariables: z.record(z.string(), z.string()),
});
export type EnvironmentWithVariablesResponse = z.infer<
  typeof environmentWithVariablesResponseSchema
>;

export const flowListItemSchema = z.object({
  flowId: z.string(),
  name: z.string(),
  path: z.string(),
});
export type FlowListItem = z.infer<typeof flowListItemSchema>;

export const flowsBundleResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
  url: z.url(),
});
export type FlowsBundleResponse = z.infer<typeof flowsBundleResponseSchema>;
