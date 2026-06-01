import { z } from "zod";

const artifactModeSchema = z.enum(["on", "off", "retain-on-failure"]);

export const qawolfConfigSchema = z.strictObject({
  outputDir: z.string().default(".qawolf"),
  timeout: z.number().int().positive().default(60_000),
  retries: z.number().int().min(0).default(0),
  bail: z.boolean().default(false),
  workers: z.number().int().min(1).default(1),
  video: artifactModeSchema.default("retain-on-failure"),
  trace: artifactModeSchema.default("retain-on-failure"),
  apiUrl: z.url().default("https://app.qawolf.com"),
});

export type QawolfConfig = z.infer<typeof qawolfConfigSchema>;
