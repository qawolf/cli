import stringWidth from "fast-string-width";

export const displayWidth = (text: string): number => stringWidth(text);

export const padColumns = (text: string, width: number): string =>
  `${text}${" ".repeat(Math.max(0, width - displayWidth(text)))}`;
