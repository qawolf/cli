// Builds Slack chat.postMessage / chat.update payloads for release
// notifications. Dependency-free so CI can run it without `bun install`.
import { splitReleaseNotes } from "./slackMrkdwn.js";

// Keep in sync with the matrix outfiles in .github/workflows/release-binaries.yml
const expectedBinaries = [
  { asset: "qawolf-linux-x64", label: "linux-x64" },
  { asset: "qawolf-linux-arm64", label: "linux-arm64" },
  { asset: "qawolf-darwin-x64", label: "darwin-x64" },
  { asset: "qawolf-darwin-arm64", label: "darwin-arm64" },
  { asset: "qawolf-windows-x64.exe", label: "windows-x64" },
];

// Slack rejects section text over 3000 characters
const sectionTextLimit = 3000;
const truncationNotice = "…\n_(truncated — full notes on GitHub)_";

export type ReleasePhase = "publish" | "binaries";

export type ReleaseInput = {
  tagName: string;
  url: string;
  body: string;
  assets: { name: string }[] | undefined;
};

export function parseReleaseInput(json: unknown): ReleaseInput {
  if (typeof json !== "object" || json === null) {
    throw new Error(
      "stdin must be JSON from `gh release view --json body,url,tagName[,assets]`",
    );
  }
  const { tagName, url, body, assets } = json as Record<string, unknown>;
  if (
    typeof tagName !== "string" ||
    typeof url !== "string" ||
    typeof body !== "string"
  ) {
    throw new Error("release JSON must include string tagName, url, and body");
  }
  if (assets !== undefined) {
    if (
      !Array.isArray(assets) ||
      !assets.every(
        (asset: unknown) =>
          typeof asset === "object" &&
          asset !== null &&
          typeof (asset as Record<string, unknown>)["name"] === "string",
      )
    ) {
      throw new Error(
        "release JSON assets must be an array of { name: string }",
      );
    }
    return { tagName, url, body, assets: assets as { name: string }[] };
  }
  return { tagName, url, body, assets: undefined };
}

function clampSection(text: string): string {
  if (text.length <= sectionTextLimit) return text;
  return (
    text.slice(0, sectionTextLimit - truncationNotice.length) + truncationNotice
  );
}

function mrkdwnSection(text: string): { type: "section"; text: object } {
  return {
    type: "section",
    text: { type: "mrkdwn", text: clampSection(text) },
  };
}

function noteSections(body: string): object[] {
  const groups = splitReleaseNotes(body);
  if (groups.length === 0) return [mrkdwnSection("_No release notes._")];
  return groups.map(({ title, text }) =>
    mrkdwnSection(title === undefined ? text : `*${title}*\n${text}`),
  );
}

function binariesLine(
  phase: ReleasePhase,
  assets: { name: string }[] | undefined,
): string {
  if (phase === "publish") return "⏳ Binaries building…";
  const uploaded = new Set((assets ?? []).map((asset) => asset.name));
  const statuses = expectedBinaries.map(
    ({ asset, label }) => `${uploaded.has(asset) ? "✅" : "❌"} ${label}`,
  );
  return `*Binaries:*  ${statuses.join("  ")}`;
}

export type SlackPayload = {
  channel: string;
  text: string;
  blocks: unknown[];
  // undefined for chat.postMessage; JSON.stringify omits it from the payload
  ts: string | undefined;
};

export function buildSlackPayload(input: {
  release: ReleaseInput;
  phase: ReleasePhase;
  channel: string;
  ts: string | undefined;
}): SlackPayload {
  const { release, phase, channel, ts } = input;
  const version = release.tagName.replace(/^v/, "");
  const npmUrl = `https://www.npmjs.com/package/@qawolf/cli/v/${version}`;
  return {
    channel,
    ts,
    text: `@qawolf/cli ${release.tagName} released`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `qawolf CLI ${release.tagName}` },
      },
      ...noteSections(release.body),
      { type: "divider" },
      mrkdwnSection(binariesLine(phase, release.assets)),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${release.url}|GitHub release> · <${npmUrl}|npm>`,
          },
        ],
      },
    ],
  };
}
