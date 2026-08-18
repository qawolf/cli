export type StringLiteral = {
  /** The literal's runtime value, with escape sequences decoded. */
  value: string;
  /** Index of the closing delimiter. */
  end: number;
};

const lineTerminator = /[\n\r\u2028\u2029]/;

/**
 * Reads the static string literal opening at `start`.
 *
 * Returns undefined when `start` does not open a literal, when the literal is
 * unterminated, or when it is a template literal containing `${...}` — an
 * interpolated value is only known at runtime, so there is no static value to
 * report.
 */
export function readStringLiteral(
  source: string,
  start: number,
): StringLiteral | undefined {
  const quote = source.charAt(start);
  if (quote !== '"' && quote !== "'" && quote !== "`") return undefined;

  let value = "";
  let i = start + 1;
  while (i < source.length) {
    const char = source.charAt(i);

    if (char === "\\") {
      const escaped = source.charAt(i + 1);

      // A line continuation lets the literal span lines and contributes
      // nothing to the value. Every line terminator counts, U+2028 and U+2029
      // included.
      if (lineTerminator.test(escaped)) {
        const crlf = escaped === "\r" && source.charAt(i + 2) === "\n";
        i += crlf ? 3 : 2;
        continue;
      }

      // Every other escape we need is an identity escape — `\"`, `\'`,
      // `` \` ``, `\\` — so the character stands for itself. Control and
      // unicode escapes are not decoded because names do not carry them:
      // rather than escape, the generator picks a delimiter the name does not
      // contain.
      value += escaped;
      i += 2;
      continue;
    }

    if (char === quote) return { value, end: i };

    if (quote === "`") {
      if (char === "$" && source.charAt(i + 1) === "{") return undefined;
    } else if (char === "\n" || char === "\r") {
      // A raw line break cannot appear in a quoted literal, so this is not one.
      // U+2028 and U+2029 are excluded on purpose: they are line terminators,
      // but ES2019 onwards allows them unescaped inside a quoted literal.
      return undefined;
    }

    value += char;
    i++;
  }

  return undefined;
}
