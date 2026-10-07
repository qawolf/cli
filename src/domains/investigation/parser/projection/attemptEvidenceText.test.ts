import { describe, expect, it } from "bun:test";

import { redactAttemptEvidence } from "./attemptEvidenceText.js";

describe("redactAttemptEvidence", () => {
  it.each([
    ["client_secret=abc123", "client_secret=[REDACTED]"],
    ['{"client_secret":"abc123"}', '{"client_secret":"[REDACTED]"}'],
    ['{"secret":"abc"}', '{"secret":"[REDACTED]"}'],
    ['{"id_token":"abc"}', '{"id_token":"[REDACTED]"}'],
    ['{"idToken":"abc"}', '{"idToken":"[REDACTED]"}'],
    ["apiToken: abc", "apiToken: [REDACTED]"],
    ["my_token=abc", "my_token=[REDACTED]"],
    ['{"privateKey":"abc"}', '{"privateKey":"[REDACTED]"}'],
    ["sent Bearer abcdef123456 upstream", "sent Bearer [REDACTED] upstream"],
    [
      "https://x.test/callback?code=AUTHCODE&state=1",
      "https://x.test/callback?code=[REDACTED]&state=1",
    ],
    [
      "https://x.test/token?client_secret=zz&grant=1",
      "https://x.test/token?client_secret=[REDACTED]&grant=1",
    ],
  ])("redacts %s", (input, expected) => {
    expect(redactAttemptEvidence(input)).toBe(expected);
  });

  it.each([
    '{"keyboard":"qwerty"}',
    '{"key":"Enter"}',
    '{"author":"Jane"}',
    ":authority: x.test",
    "monkey=banana",
    "https://x.test/search?zipcode=10001",
    "the bearer of news",
  ])("keeps %s", (input) => {
    expect(redactAttemptEvidence(input)).toBe(input);
  });
});
