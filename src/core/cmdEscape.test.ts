import { describe, expect, it } from "bun:test";

import { escapeArgument, escapeCommand } from "./cmdEscape.js";

describe("escapeArgument", () => {
  it("wraps a plain argument in quotes", () => {
    expect(escapeArgument("install")).toBe('^^^"install^^^"');
  });

  // A .cmd shim re-enters cmd.exe, which consumes one layer of ^ escapes, so
  // every meta char needs two. The wrapping quotes are meta chars themselves.
  it("double-escapes meta chars, including the quotes it added", () => {
    expect(escapeArgument("a&b")).toBe('^^^"a^^^&b^^^"');
  });

  it("escapes the wildcard meta chars", () => {
    expect(escapeArgument("*.ts")).toBe('^^^"^^^*.ts^^^"');
    expect(escapeArgument("a?b")).toBe('^^^"a^^^?b^^^"');
  });

  it("backslash-escapes a quote inside the argument", () => {
    expect(escapeArgument('a"b')).toBe('^^^"a\\^^^"b^^^"');
  });

  // Without doubling, the trailing backslash would escape the closing quote
  // and swallow whatever follows on the command line.
  it("doubles a trailing backslash", () => {
    expect(escapeArgument("C:\\dir\\")).toBe('^^^"C:\\dir\\\\^^^"');
  });

  it("doubles backslashes that precede a quote", () => {
    expect(escapeArgument('a\\"b')).toBe('^^^"a\\\\\\^^^"b^^^"');
  });
});

describe("escapeCommand", () => {
  it("leaves a path with no meta chars alone", () => {
    expect(escapeCommand("C:\\proj\\node_modules\\.bin\\npm.cmd")).toBe(
      "C:\\proj\\node_modules\\.bin\\npm.cmd",
    );
  });

  // Windows install paths really do contain spaces and parentheses.
  it("escapes spaces and parentheses in a path", () => {
    expect(escapeCommand("C:\\Program Files (x86)\\npm.cmd")).toBe(
      "C:\\Program^ Files^ ^(x86^)\\npm.cmd",
    );
  });

  // Only the outer cmd.exe reads the command, so one layer of ^ is enough.
  it("escapes meta chars once, unlike arguments", () => {
    expect(escapeCommand("a&b")).toBe("a^&b");
  });
});
