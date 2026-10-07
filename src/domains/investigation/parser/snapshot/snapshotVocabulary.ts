// Which parts of a page snapshot reach the model.

export const skippedTags = new Set([
  "HEAD",
  "LINK",
  "META",
  "NOSCRIPT",
  "PATH",
  "SCRIPT",
  "STYLE",
  "SVG",
]);
export const shownTags = new Set([
  "A",
  "BUTTON",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "HEADER",
  "IMG",
  "INPUT",
  "LABEL",
  "LI",
  "MAIN",
  "NAV",
  "SELECT",
  "TEXTAREA",
]);
export const shownAttributes = [
  "alt",
  "aria-label",
  "href",
  "id",
  "name",
  "placeholder",
  "role",
  "type",
];
