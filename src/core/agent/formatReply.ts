import type { AgentReply } from "./session.js";

const speaker = "QA Wolf";

// Local wall-clock time, which is what someone watching a session compares
// against. Left out rather than printed as nonsense for a time that cannot be
// read.
function replyTime(askedAt: string): string | undefined {
  const at = new Date(askedAt);
  if (Number.isNaN(at.getTime())) return undefined;
  return at.toTimeString().slice(0, 8);
}

/**
 * A reply as its parts, for a renderer to frame.
 *
 * Nothing here draws a rail or a mark. The terminal's framing is clack's, and
 * an agent's is Markdown, so the two live with the renderers that know which
 * they are.
 *
 * `listChoices` is for output nothing will prompt after: a pipe, an agent, a
 * plain `agent get`. Where a prompt follows, it puts the same options on screen,
 * and printing them twice reads as two separate questions.
 */
export function replyParts(
  reply: AgentReply,
  options: { listChoices: boolean },
): { body: string; headline: string } {
  const time = replyTime(reply.askedAt);
  const choices =
    options.listChoices && reply.choices !== undefined
      ? ["", ...reply.choices.map((choice) => `- ${choice}`)]
      : [];
  return {
    body: [reply.text.trim(), ...choices].join("\n"),
    headline: time === undefined ? speaker : `${speaker}  ${time}`,
  };
}
