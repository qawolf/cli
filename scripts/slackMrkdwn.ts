// Converts changeset release-note markdown into Slack mrkdwn.

const groupTitles: Record<string, string> = {
  "Major Changes": "💥 Major changes",
  "Minor Changes": "✨ Minor changes",
  "Patch Changes": "🩹 Patch changes",
};

// Pragmatic, not a full markdown parser: bold, links, and bullets are the
// only constructs changesets emit.
export function toMrkdwn(markdown: string): string {
  return (
    markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "<$2|$1>")
      .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
      .replace(/^(\s*)[-*]\s+/gm, "$1• ")
      // changeset bullets lead with a commit hash — noise for Slack readers
      .replace(/^(\s*)• [0-9a-f]{7,40}: /gm, "$1• ")
      // dedent continuation paragraphs; sub-bullets keep their indent
      .replace(/^[ \t]+(?![ \t]*•)/gm, "")
      .trim()
  );
}

export type NoteGroup = { title: string | undefined; text: string };

// Splits release notes on markdown headings so each change group ("Minor
// Changes", "Patch Changes", …) can render as its own Slack block.
export function splitReleaseNotes(body: string): NoteGroup[] {
  const groups: NoteGroup[] = [];
  let current: NoteGroup = { title: undefined, text: "" };
  for (const line of body.split("\n")) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current.text.trim()) groups.push(current);
      const title = heading[1] ?? "";
      current = { title: groupTitles[title] ?? title, text: "" };
    } else {
      current.text += `${line}\n`;
    }
  }
  if (current.text.trim()) groups.push(current);
  return groups.map((group) => ({
    title: group.title,
    text: toMrkdwn(group.text),
  }));
}
