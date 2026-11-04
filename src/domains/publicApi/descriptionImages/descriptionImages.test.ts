import { afterEach, describe, expect, it, mock } from "bun:test";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { buffer } from "node:stream/consumers";

import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type { Fs } from "~/shell/fs.js";
import {
  makeCallPublicApiMock,
  makeMockPlatformClient,
} from "~/shell/platform/createPlatformClient.testUtils.js";

import {
  buildCommandSpecs,
  type CommandSpec,
} from "~/domains/publicApi/commandSpecs.js";
import { handlePublicApiCommand } from "~/domains/publicApi/handle.js";
import { ctxWith } from "~/domains/publicApi/handle.testUtils.js";

afterEach(() => {
  mock.restore();
});

const imageDirectory = join(tmpdir(), "qawolf-issue-images");

const pngBytes = Buffer.concat([
  Buffer.from("\x89PNG\r\n\x1a\n", "latin1"),
  Buffer.from("cart total pixels"),
]);
const pngDataUrl = `data:image/png;base64,${pngBytes.toString("base64")}`;

const jpegBytes = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from("checkout button pixels"),
]);
const jpegDataUrl = `data:image/jpeg;base64,${jpegBytes.toString("base64")}`;

const issueSpec = (action: "find" | "get" | "update"): CommandSpec => {
  const spec = buildCommandSpecs({
    issue: { [action]: publicContractsV1.issue[action] },
  }).find((candidate) => candidate.trpcPath === `public.issue.${action}`);
  if (!spec) throw new Error(`issue.${action} spec missing`);
  return spec;
};

function setUp({ value }: { value: unknown }) {
  const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
    ok: true,
    value,
  });
  const output = mock((_data: unknown, _humanMessage: string) => {});
  const ctx = ctxWith(
    { ...makeFakeUI("json"), output },
    makeMockPlatformClient({ callPublicApi }),
  );
  return { callPublicApi, ctx, output };
}

function printed(output: ReturnType<typeof setUp>["output"]) {
  const [call] = output.mock.calls;
  if (!call) throw new Error("nothing was printed");
  const [data, humanMessage] = call;
  return { data, humanMessage };
}

const readBytes = (fs: Fs, path: string) => buffer(fs.createReadStream(path));

const savedPath = (markdown: string): string => {
  const match = /\]\((\/[^)]+)\)/.exec(markdown);
  if (!match?.[1]) throw new Error(`no image path in ${markdown}`);
  return match[1];
};

describe("issue description images", () => {
  it("prints an image in issue get as a file path and writes the image there", async () => {
    const { ctx, output } = setUp({
      value: {
        issue: {
          createdAt: new Date("2026-11-03T12:00:00Z"),
          description: `**Actual:** wrong total\n\n![Cart total](${pngDataUrl})`,
          issueId: "issue-1",
        },
      },
    });

    const result = await handlePublicApiCommand(ctx, issueSpec("get"), {
      issueId: "issue-1",
    });

    expect(result).toBeUndefined();
    const { data, humanMessage } = printed(output);
    const path = savedPath(humanMessage);
    expect(path.startsWith(`${imageDirectory}/`)).toBe(true);
    expect(path.endsWith(".png")).toBe(true);
    expect(data).toEqual({
      issue: {
        createdAt: new Date("2026-11-03T12:00:00Z"),
        description: `**Actual:** wrong total\n\n![Cart total](${path})`,
        issueId: "issue-1",
      },
    });
    expect(humanMessage).not.toContain("base64");
    expect(await readBytes(ctx.fs, path)).toEqual(pngBytes);
  });

  it("prints every image on an issue find page as a file, one file per image", async () => {
    const { ctx, output } = setUp({
      value: {
        issues: [
          {
            description: `![Cart](${pngDataUrl}) and again ![Cart](${pngDataUrl})`,
            issueId: "issue-1",
          },
          {
            description: `![Checkout](${jpegDataUrl})`,
            issueId: "issue-2",
          },
          { description: "No screenshot", issueId: "issue-3" },
        ],
      },
    });

    const result = await handlePublicApiCommand(ctx, issueSpec("find"), {
      type: "bug",
    });

    expect(result).toBeUndefined();
    const { data, humanMessage } = printed(output);
    expect(humanMessage).not.toContain("base64");
    expect(JSON.stringify(data)).not.toContain("base64");
    const files = await ctx.fs.readdir(imageDirectory);
    expect(
      files
        .map((name) => extname(name))
        .toSorted((left, right) => left.localeCompare(right)),
    ).toEqual([".jpg", ".png"]);
    expect(humanMessage).toContain("No screenshot");
  });

  it("keeps the image when Tester writes a printed description back", async () => {
    const description = `**Expected:** $10\n\n![Cart total](${pngDataUrl})`;
    const read = setUp({ value: { issue: { description, issueId: "i-1" } } });
    await handlePublicApiCommand(read.ctx, issueSpec("get"), {
      issueId: "i-1",
    });
    const printedDescription = z
      .object({ issue: z.object({ description: z.string() }) })
      .parse(printed(read.output).data).issue.description;

    const callPublicApi = makeCallPublicApiMock().mockResolvedValue({
      ok: true,
      value: { issue: { description, issueId: "i-1" } },
    });
    const write = ctxWith(
      makeFakeUI("json"),
      makeMockPlatformClient({ callPublicApi }),
    );
    const spec = issueSpec("update");
    const result = await handlePublicApiCommand(
      { ...write, fs: read.ctx.fs },
      spec,
      {
        description: printedDescription,
        issueId: "i-1",
      },
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(spec.contract, {
      description,
      issueId: "i-1",
    });
  });

  it("refuses to send a description whose local image file is missing", async () => {
    const { callPublicApi, ctx } = setUp({ value: {} });

    const result = await handlePublicApiCommand(ctx, issueSpec("update"), {
      description: "![Cart](/tmp/missing-shot.png)",
      issueId: "i-1",
    });

    expect(result).toEqual({
      error: "No image file at /tmp/missing-shot.png.",
    });
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("leaves a team storage image path for the platform to read", async () => {
    const { callPublicApi, ctx } = setUp({ value: {} });
    const spec = issueSpec("update");

    await handlePublicApiCommand(ctx, spec, {
      description: "![Cart](<uploads/cart.png>)",
      issueId: "i-1",
    });

    expect(callPublicApi).toHaveBeenCalledWith(spec.contract, {
      description: "![Cart](<uploads/cart.png>)",
      issueId: "i-1",
    });
  });
});
