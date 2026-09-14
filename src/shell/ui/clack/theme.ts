import { styleText } from "node:util";

// QA Wolf blue: #3B3BEF → RGB(59, 59, 239)
const qaWolfBlueBg = "\x1b[48;2;59;59;239m";
const whiteBold = "\x1b[97;1m";
const reset = "\x1b[0m";

export function styledTitle(title: string): string {
  return `${qaWolfBlueBg}${whiteBold} ${title} ${reset}`;
}

// Painted with the same styleText clack paints the rail with, so the mark can
// never disagree with the guide line either side of it about colour.
//
// clack spends its own marks on outcomes: `●` info, `◆` success, `▲` warn,
// `■` error. `◇` is the one left for a line that reports no outcome at all,
// which is what someone else talking is.
/** The mark that opens a message from someone other than the CLI. */
export function replySymbol(): string {
  return styleText("cyan", "\u25c7");
}
