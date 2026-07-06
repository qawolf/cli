// A type annotation that must be stripped for this to run on Node 20 (which has
// no native TypeScript support) — proves the oxc loader transpiles, not just
// resolves.
export const greeting: string = "node20-ok";
