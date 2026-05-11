// QA Wolf blue: #3B3BEF → RGB(59, 59, 239)
const qaWolfBlueBg = "\x1b[48;2;59;59;239m";
const whiteBold = "\x1b[97;1m";
const reset = "\x1b[0m";

export function styledTitle(title: string): string {
  return `${qaWolfBlueBg}${whiteBold} ${title} ${reset}`;
}
