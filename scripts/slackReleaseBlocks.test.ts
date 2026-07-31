import { describe, expect, it } from "bun:test";

import {
  buildSlackPayload,
  parseReleaseInput,
  type ReleaseInput,
  type SlackPayload,
} from "./slackReleaseBlocks.js";

const release: ReleaseInput = {
  tagName: "v1.4.0",
  url: "https://github.com/qawolf/cli/releases/tag/v1.4.0",
  body: "### Patch Changes\n\n- abc1234: fix the thing",
  assets: undefined,
};

function blockTexts(payload: SlackPayload): string[] {
  const blocks = payload.blocks as { text?: { text: string } }[];
  return blocks.map((block) => block.text?.text ?? "");
}

describe("parseReleaseInput", () => {
  it("accepts gh release view output with assets", () => {
    const parsed = parseReleaseInput({
      tagName: "v1.4.0",
      url: release.url,
      body: release.body,
      assets: [{ name: "qawolf-linux-x64" }],
    });
    expect(parsed.assets).toEqual([{ name: "qawolf-linux-x64" }]);
  });

  it("rejects JSON missing required fields", () => {
    expect(() => parseReleaseInput({ tagName: "v1.4.0" })).toThrow(
      "release JSON must include string tagName, url, and body",
    );
  });

  it("rejects malformed assets", () => {
    expect(() =>
      parseReleaseInput({ ...release, assets: ["qawolf-linux-x64"] }),
    ).toThrow("assets must be an array of { name: string }");
  });
});

describe("buildSlackPayload", () => {
  it("builds a publish payload with a pending binaries line and no ts", () => {
    const payload = buildSlackPayload({
      release,
      phase: "publish",
      channel: "C0123456789",
      ts: undefined,
    });
    expect(payload.channel).toBe("C0123456789");
    expect(payload.text).toBe("@qawolf/cli v1.4.0 released");
    // JSON.stringify drops undefined, so the wire payload has no ts field
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty("ts");
    const texts = blockTexts(payload);
    expect(texts[0]).toBe("qawolf CLI v1.4.0");
    expect(texts[1]).toBe("*🩹 Patch changes*\n• fix the thing");
    expect(texts[2]).toBe(""); // divider
    expect(texts[3]).toBe("⏳ Binaries building…");
  });

  it("links the GitHub release and the published npm version", () => {
    const payload = buildSlackPayload({
      release,
      phase: "publish",
      channel: "C0123456789",
      ts: undefined,
    });
    const context = payload.blocks[4] as { elements: { text: string }[] };
    expect(context.elements[0]?.text).toBe(
      `<${release.url}|GitHub release> · <https://www.npmjs.com/package/@qawolf/cli/v/1.4.0|npm>`,
    );
  });

  it("marks each expected binary against uploaded assets and includes ts", () => {
    const payload = buildSlackPayload({
      release: {
        ...release,
        assets: [
          { name: "qawolf-linux-x64" },
          { name: "qawolf-linux-arm64" },
          { name: "qawolf-darwin-x64" },
          { name: "qawolf-darwin-arm64" },
        ],
      },
      phase: "binaries",
      channel: "C0123456789",
      ts: "1234567890.123456",
    });
    expect(payload.ts).toBe("1234567890.123456");
    expect(blockTexts(payload)[3]).toBe(
      "*Binaries:*  ✅ linux-x64  ✅ linux-arm64  ✅ darwin-x64  ✅ darwin-arm64  ❌ windows-x64",
    );
  });

  it("truncates oversized release notes under Slack's section limit", () => {
    const payload = buildSlackPayload({
      release: { ...release, body: "x".repeat(4000) },
      phase: "publish",
      channel: "C0123456789",
      ts: undefined,
    });
    const notes = blockTexts(payload)[1] ?? "";
    expect(notes.length).toBe(3000);
    expect(notes.endsWith("_(truncated — full notes on GitHub)_")).toBe(true);
  });
});
