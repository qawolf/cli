import { describe, expect, it } from "bun:test";

import { parseDotenv, serializeDotenv } from "./dotenv.js";

describe("serializeDotenv", () => {
  it('emits KEY="value" lines sorted by key with trailing newline', () => {
    expect(serializeDotenv({ B: "two", A: "one" })).toBe('A="one"\nB="two"\n');
  });

  it("returns an empty string for an empty record", () => {
    expect(serializeDotenv({})).toBe("");
  });

  it("escapes backslash, double-quote, newline, return, and tab", () => {
    expect(
      serializeDotenv({
        QUOTE: 'a"b',
        BACK: "a\\b",
        NL: "a\nb",
        CR: "a\rb",
        TAB: "a\tb",
      }),
    ).toBe(
      'BACK="a\\\\b"\n' +
        'CR="a\\rb"\n' +
        'NL="a\\nb"\n' +
        'QUOTE="a\\"b"\n' +
        'TAB="a\\tb"\n',
    );
  });

  it("preserves spaces, equals signs, and hashes inside the quoted value", () => {
    expect(serializeDotenv({ URL: "a=b c#d" })).toBe('URL="a=b c#d"\n');
  });

  it("quotes a key that contains special characters (email-style OTP key)", () => {
    expect(
      serializeDotenv({
        "app+user@example.com_OTP_URI": "otpauth://totp/x",
      }),
    ).toBe('"app+user@example.com_OTP_URI"="otpauth://totp/x"\n');
  });

  it("quotes a key with a space or a leading digit", () => {
    expect(serializeDotenv({ "BAD KEY": "x" })).toBe('"BAD KEY"="x"\n');
    expect(serializeDotenv({ "1LEADING_DIGIT": "x" })).toBe(
      '"1LEADING_DIGIT"="x"\n',
    );
  });
});

describe("parseDotenv", () => {
  it('parses simple KEY="value" lines', () => {
    expect(parseDotenv('TOKEN="abc"\nURL="https://example.com"\n')).toEqual({
      TOKEN: "abc",
      URL: "https://example.com",
    });
  });

  it("returns an empty record for an empty file", () => {
    expect(parseDotenv("")).toEqual({});
  });

  it("ignores blank lines", () => {
    expect(parseDotenv('A="1"\n\nB="2"\n')).toEqual({ A: "1", B: "2" });
  });

  it("trims whitespace around lines, including CRLF endings", () => {
    expect(parseDotenv('A="1"\r\n  B="2"  \r\n')).toEqual({ A: "1", B: "2" });
  });

  it('unescapes \\\\, ", \\n, \\r, \\t inside values', () => {
    expect(
      parseDotenv(
        'BACK="a\\\\b"\nCR="a\\rb"\nNL="a\\nb"\nQUOTE="a\\"b"\nTAB="a\\tb"\n',
      ),
    ).toEqual({
      BACK: "a\\b",
      CR: "a\rb",
      NL: "a\nb",
      QUOTE: 'a"b',
      TAB: "a\tb",
    });
  });

  it("throws on a malformed line", () => {
    expect(() => parseDotenv("not-a-valid-line\n")).toThrow(/Cannot parse/i);
    expect(() => parseDotenv('UNTERMINATED="oops\n')).toThrow(/Cannot parse/i);
  });

  it("parses a quoted-key line", () => {
    expect(
      parseDotenv('"weird+key@host.com_OTP_URI"="otpauth://totp/x"\n'),
    ).toEqual({ "weird+key@host.com_OTP_URI": "otpauth://totp/x" });
  });

  it("parses a quoted key containing an escaped double-quote", () => {
    expect(parseDotenv('"a\\"b"="v"\n')).toEqual({ 'a"b': "v" });
  });
});

describe("serializeDotenv ↔ parseDotenv round trip", () => {
  it("preserves arbitrary values and non-POSIX keys exactly", () => {
    const sample = {
      ALPHA: "simple",
      BETA: 'with "quotes"',
      GAMMA: "newline\nand\rreturn\tand\ttab",
      DELTA: "back\\slash",
      EPSILON: "spaces and = and # and / inside",
      ZETA: "",
      "weird+key@host.com_OTP_URI": 'value with = and " and \n',
    };

    const round = parseDotenv(serializeDotenv(sample));

    expect(round).toEqual(sample);
  });
});
