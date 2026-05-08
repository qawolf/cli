import { z } from "zod";

export const flowsBundleResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
  url: z.url(),
});
export type FlowsBundleResponse = z.infer<typeof flowsBundleResponseSchema>;
