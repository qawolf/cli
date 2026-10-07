import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";

const maxHeaderCount = 100;
const maxHeaderNameBytes = 256;
const maxHeaderValueBytes = 2 * 1024;
const maxHeadersBytes = 16 * 1024;

export function redactInspectionHeaders(headers: Record<string, string>) {
  const entries = Object.entries(headers);
  const boundedEntries: [string, string][] = [];
  let aggregateBytes = 0;
  let truncated = entries.length > maxHeaderCount;
  for (const [rawName, rawValue] of entries.slice(0, maxHeaderCount)) {
    const name = redactAndBoundAttemptEvidenceResult(
      rawName,
      maxHeaderNameBytes,
    );
    const prefix = `${rawName}: `;
    const value = redactAndBoundAttemptEvidenceResult(
      `${prefix}${rawValue}`,
      Buffer.byteLength(prefix) + maxHeaderValueBytes,
    );
    const sanitizedValue = value.text.slice(prefix.length);
    const remainingBytes = maxHeadersBytes - aggregateBytes;
    const nameBytes = Buffer.byteLength(name.text);
    if (nameBytes >= remainingBytes) {
      truncated = true;
      break;
    }
    const boundedValue = redactAndBoundAttemptEvidenceResult(
      sanitizedValue,
      Math.min(maxHeaderValueBytes, remainingBytes - nameBytes),
    );
    boundedEntries.push([name.text, boundedValue.text]);
    aggregateBytes += nameBytes + Buffer.byteLength(boundedValue.text);
    truncated ||= name.truncated || value.truncated || boundedValue.truncated;
  }
  return { headers: Object.fromEntries(boundedEntries), truncated };
}
