// Allow dot-access for QAWOLF_COMPILED so bun --define replaces it at binary
// build time. Bracket notation (process.env["..."]) is not replaced by --define.
declare global {
  namespace NodeJS {
    // oxlint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface ProcessEnv {
      QAWOLF_COMPILED?: string;
    }
  }
}

export {};
