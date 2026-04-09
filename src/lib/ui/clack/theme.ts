// QA Wolf blue: #3B3BEF → RGB(59, 59, 239)
const QA_WOLF_BLUE_BG = "\x1b[48;2;59;59;239m";
const WHITE_BOLD = "\x1b[97;1m";
const RESET = "\x1b[0m";

export function styledTitle(title: string): string {
  return `${QA_WOLF_BLUE_BG}${WHITE_BOLD} ${title} ${RESET}`;
}
