// oxlint-disable eslint/max-lines -- Keep the conventional redaction passes and UTF-8 bounding logic aligned with the platform implementation.

const redacted = "[REDACTED]";
const sensitiveFieldNames = [
  "accessToken",
  "access_token",
  "access-token",
  "refreshToken",
  "refresh_token",
  "refresh-token",
  "api_key",
  "api-key",
  "apiKey",
  "apikey",
  "set-cookie",
  "authorization",
  "cookie",
  "password",
  "token",
  "value",
];
const sensitiveFieldPattern = sensitiveFieldNames.join("|");
const signedUrlFieldPattern = [
  "accessToken",
  "access_token",
  "access-token",
  "refreshToken",
  "refresh_token",
  "refresh-token",
  "api_key",
  "api-key",
  "apiKey",
  "apikey",
  "authorization",
  "password",
  "token",
  "signature",
  "sig",
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-security-token",
  "x-goog-signature",
  "x-goog-credential",
  "awsaccesskeyid",
  "googleaccessid",
  "key-pair-id",
  "policy",
].join("|");
// A JWT's header is base64url JSON, so it always starts with "eyJ" (`{"`).
// Matching the token itself catches the ones no field name points at, such as
// a session token streamed inside a React Server Components payload. The
// signature is optional so a token cut off by a truncated body still matches.
const jwtPattern = /eyJ[\w-]+\.[\w-]+(?:\.[\w-]*){0,3}/g;

function redactQuotedAssignments(
  text: string,
  assignmentPattern: RegExp,
  options: { escaped: boolean; quote: '"' | "'" },
) {
  let result = "";
  let cursor = 0;
  assignmentPattern.lastIndex = 0;

  for (let match = assignmentPattern.exec(text); match; ) {
    const valueStart = match.index + match[0].length;
    result += text.slice(cursor, valueStart) + redacted;

    let closingQuote = -1;
    let precedingBackslashes = 0;
    for (let index = valueStart; index < text.length; index += 1) {
      if (text[index] === "\\") {
        precedingBackslashes += 1;
        continue;
      }
      if (text[index] !== options.quote) {
        precedingBackslashes = 0;
        continue;
      }
      const isClosingQuote = options.escaped
        ? precedingBackslashes === 1
        : precedingBackslashes % 2 === 0;
      const suffix = text.slice(index + 1);
      if (isClosingQuote && /^\s*(?:[,}\]]|$)/.test(suffix)) {
        closingQuote = options.escaped ? index - 1 : index;
        break;
      }
      precedingBackslashes = 0;
    }

    if (closingQuote === -1)
      return result + (text.endsWith("[TRUNCATED]") ? "[TRUNCATED]" : "");
    const quoteLength = options.escaped ? 2 : 1;
    result += text.slice(closingQuote, closingQuote + quoteLength);
    cursor = closingQuote + quoteLength;
    assignmentPattern.lastIndex = cursor;
    match = assignmentPattern.exec(text);
  }

  return result + text.slice(cursor);
}

function redactCallArguments(text: string): string {
  const callPattern = /\b(?:fill|type)\(/gi;
  let result = "";
  let cursor = 0;

  for (let match = callPattern.exec(text); match; ) {
    const valueStart = match.index + match[0].length;
    result += text.slice(cursor, valueStart) + redacted;
    let depth = 1;
    let quote: '"' | "'" | "`" | undefined;
    let escaped = false;
    let valueEnd = valueStart;

    for (; valueEnd < text.length; valueEnd += 1) {
      const character = text[valueEnd];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = undefined;
        }
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) return result + text.slice(valueEnd);
    result += ")";
    cursor = valueEnd + 1;
    callPattern.lastIndex = cursor;
    match = callPattern.exec(text);
  }

  return result + text.slice(cursor);
}

export function redactAttemptEvidence(text: string): string {
  const jwtRedacted = text.replace(jwtPattern, redacted);
  const userInfoRedacted = jwtRedacted.replace(
    /((?:https?:)?\/\/)[^/\s?#]*@/gi,
    `$1${redacted}@`,
  );
  const queryRedacted = userInfoRedacted.replace(
    new RegExp(`([?&](?:${signedUrlFieldPattern})=)([^&#\\s"'\\\\]*)`, "gi"),
    `$1${redacted}`,
  );
  const jsonRedacted = redactQuotedAssignments(
    queryRedacted,
    new RegExp(`"(?:${sensitiveFieldPattern})"\\s*:\\s*"`, "gi"),
    { escaped: false, quote: '"' },
  );
  const escapedJsonRedacted = redactQuotedAssignments(
    jsonRedacted,
    new RegExp(`\\\\"(?:${sensitiveFieldPattern})\\\\"\\s*:\\s*\\\\"`, "gi"),
    { escaped: true, quote: '"' },
  );
  const singleQuotedJsonRedacted = redactQuotedAssignments(
    escapedJsonRedacted,
    new RegExp(`'(?:${sensitiveFieldPattern})'\\s*:\\s*'`, "gi"),
    { escaped: false, quote: "'" },
  );
  const doubleKeySingleValueRedacted = redactQuotedAssignments(
    singleQuotedJsonRedacted,
    new RegExp(`"(?:${sensitiveFieldPattern})"\\s*:\\s*'`, "gi"),
    { escaped: false, quote: "'" },
  );
  const mixedQuotedJsonRedacted = redactQuotedAssignments(
    doubleKeySingleValueRedacted,
    new RegExp(`'(?:${sensitiveFieldPattern})'\\s*:\\s*"`, "gi"),
    { escaped: false, quote: '"' },
  );
  const scalarJsonRedacted = mixedQuotedJsonRedacted.replace(
    new RegExp(
      `(["'](?:${sensitiveFieldPattern})["']\\s*:\\s*)(?!["'])[^,}\\]\\r\\n]*`,
      "gi",
    ),
    `$1${redacted}`,
  );
  const escapedScalarJsonRedacted = scalarJsonRedacted.replace(
    new RegExp(
      `(\\\\"(?:${sensitiveFieldPattern})\\\\"\\s*:\\s*)(?!\\\\")[^,}\\]\\r\\n]*`,
      "gi",
    ),
    `$1${redacted}`,
  );

  return redactCallArguments(
    escapedScalarJsonRedacted.replace(
      new RegExp(
        `(?<![?&])\\b(${sensitiveFieldPattern})(\\s*[:=]\\s*)[^\\r\\n]*`,
        "gi",
      ),
      `$1$2${redacted}`,
    ),
  );
}

export function redactAndBoundAttemptEvidenceResult(
  text: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  return boundAttemptEvidenceText(redactAttemptEvidence(text), maxBytes);
}

function boundAttemptEvidenceText(
  text: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text);
  if (bytes.byteLength <= maxBytes) return { text, truncated: false };
  const suffix = "[TRUNCATED]";
  if (maxBytes <= suffix.length)
    return { text: suffix.slice(0, maxBytes), truncated: true };
  const limit = maxBytes - suffix.length;
  let boundary = limit;
  let sequenceStart = boundary - 1;
  while (sequenceStart >= 0 && ((bytes[sequenceStart] ?? 0) & 0xc0) === 0x80)
    sequenceStart -= 1;
  const leadingByte = bytes[sequenceStart] ?? 0;
  const sequenceLength =
    leadingByte < 0x80
      ? 1
      : leadingByte < 0xe0
        ? 2
        : leadingByte < 0xf0
          ? 3
          : 4;
  if (boundary - sequenceStart < sequenceLength) boundary = sequenceStart;
  const prefix = bytes.subarray(0, boundary).toString("utf8");
  return { text: prefix + suffix, truncated: true };
}

export function boundAttemptPageText(text: string) {
  return boundAttemptEvidenceText(text, 8 * 1024);
}
