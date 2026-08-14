import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { buildOutputFieldDocs } from "./outputFields.js";

describe("buildOutputFieldDocs", () => {
  it("flattens nested arrays into dotted paths marking each array", () => {
    const schema = z.object({
      flows: z
        .array(
          z.object({
            attempts: z
              .array(z.object({ traceUrl: z.string().describe("The trace.") }))
              .describe("The attempts."),
          }),
        )
        .describe("The flows."),
    });

    expect(buildOutputFieldDocs(schema)).toEqual([
      { path: "flows", description: "The flows." },
      { path: "flows[].attempts", description: "The attempts." },
      { path: "flows[].attempts[].traceUrl", description: "The trace." },
    ]);
  });

  it("lists a field shared by union branches once", () => {
    const schema = z.object({
      attempt: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("passed"),
          traceUrl: z.string().describe("Signed URL for the trace."),
        }),
        z.object({
          status: z.literal("failed"),
          traceUrl: z.string().describe("Signed URL for the trace."),
        }),
      ]),
    });

    const paths = buildOutputFieldDocs(schema).map((field) => field.path);
    expect(paths.filter((path) => path === "attempt.traceUrl")).toHaveLength(1);
  });

  // One branch's prose describes that branch, not the field. Showing it alone
  // reads as the field's meaning: the canceled variant's "terminated without
  // reaching a verdict" would describe every attempt's status.
  it("enumerates a literal field's values rather than one branch's prose", () => {
    const schema = z.object({
      attempt: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("automated").describe("Ran on a runner.") }),
        z.object({ kind: z.literal("manual").describe("Ran in a browser.") }),
      ]),
    });

    expect(buildOutputFieldDocs(schema)).toEqual([
      { path: "attempt.kind", description: "One of: automated, manual" },
    ]);
  });

  it("documents a field whose branches are bare literals", () => {
    const schema = z.object({
      mode: z
        .union([z.literal("fast"), z.literal("slow")])
        .describe("How it ran."),
      bare: z.union([z.literal("a"), z.literal("b")]),
    });

    expect(buildOutputFieldDocs(schema)).toEqual([
      { path: "mode", description: "How it ran. One of: fast, slow" },
      { path: "bare", description: "One of: a, b" },
    ]);
  });

  // A flow's status is a literal in one response shape and an enum in another.
  it("counts enum members among a field's values", () => {
    const schema = z.object({
      status: z.union([
        z.object({ status: z.literal("failed") }),
        z.object({ status: z.enum(["passed", "canceled"]) }),
      ]),
    });

    expect(buildOutputFieldDocs(schema)).toEqual([
      {
        path: "status.status",
        description: "One of: failed, passed, canceled",
      },
    ]);
  });

  it("omits fields that carry no description", () => {
    const schema = z.object({
      documented: z.string().describe("Documented."),
      bare: z.string(),
    });

    expect(buildOutputFieldDocs(schema)).toEqual([
      { path: "documented", description: "Documented." },
    ]);
  });

  // Every issue.* contract returns dates, which have no JSON Schema form and
  // throw under zod's default policy. They must still be documented.
  it("documents a field whose type JSON Schema cannot represent", () => {
    const schema = z.object({
      createdAt: z.date().describe("When it was created."),
    });

    expect(buildOutputFieldDocs(schema)).toEqual([
      { path: "createdAt", description: "When it was created." },
    ]);
  });
});
