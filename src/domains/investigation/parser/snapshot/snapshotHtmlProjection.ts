// oxlint-disable eslint/max-lines -- Keep the sanitizer and its byte-budget writer aligned with the platform implementation.

import { redactAttemptEvidence } from "~/domains/investigation/parser/projection/attemptEvidenceText.js";

import type { Element, Node } from "./snapshotProjection.js";

const maxHtmlBytes = 64 * 1024;
const maxHtmlDepth = 100;
const maxHtmlNodes = 10_000;
const omittedTags = new Set([
  "APPLET",
  "BASE",
  "EMBED",
  "FRAME",
  "FRAMESET",
  "IFRAME",
  "LINK",
  "META",
  "NOSCRIPT",
  "OBJECT",
  "PORTAL",
  "SCRIPT",
  "STYLE",
  "SVG",
]);
const validName = /^[A-Za-z][A-Za-z0-9:._-]*$/;
const urlAttributeNames = new Set([
  "action",
  "data",
  "formaction",
  "href",
  "poster",
  "src",
  "srcset",
  "xlink:href",
]);
const formTags = new Set(["BUTTON", "INPUT", "OPTION", "SELECT", "TEXTAREA"]);
const sensitiveAttributeName =
  /(?:^|[-_:])(?:access[-_:]?token|api[-_:]?key|authorization|cookie|password|refresh[-_:]?token|set[-_:]?cookie|signature|token)(?:$|[-_:])/i;
const allowedUrlSchemes = new Set(["http", "https", "mailto", "tel"]);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

class HtmlWriter {
  readonly chunks: string[] = [];
  length = 0;
  stopped = false;
  truncated = false;

  append(value: string, reservedBytes: number): boolean {
    const bytes = Buffer.byteLength(value);
    if (this.length + bytes + reservedBytes > maxHtmlBytes) {
      this.stopped = true;
      this.truncated = true;
      return false;
    }
    this.chunks.push(value);
    this.length += bytes;
    return true;
  }

  appendText(value: string, reservedBytes: number) {
    if (this.append(value, reservedBytes)) return;
    const availableBytes = maxHtmlBytes - this.length - reservedBytes;
    if (availableBytes <= 0) return;
    let low = 0;
    let high = value.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (Buffer.byteLength(value.slice(0, middle)) <= availableBytes)
        low = middle;
      else high = middle - 1;
    }
    if (low > 0 && /[\uD800-\uDBFF]/.test(value[low - 1] ?? "")) low -= 1;
    const unmatchedEntity = value.lastIndexOf("&", low - 1);
    const lastEntityEnd = value.lastIndexOf(";", low - 1);
    if (unmatchedEntity > lastEntityEnd) low = unmatchedEntity;
    const prefix = value.slice(0, low);
    if (prefix) {
      this.chunks.push(prefix);
      this.length += Buffer.byteLength(prefix);
    }
  }
}

function sanitizedAttributeValue(
  element: Element,
  name: string,
  value: string,
) {
  const normalizedName = name.toLowerCase();
  const normalizedTag = element.tag.toUpperCase();
  if (
    normalizedName === "srcdoc" ||
    normalizedName === "style" ||
    normalizedName.startsWith("on")
  )
    return undefined;
  if (
    sensitiveAttributeName.test(normalizedName) ||
    (normalizedName === "value" && formTags.has(normalizedTag))
  )
    return "[REDACTED]";
  if (urlAttributeNames.has(normalizedName)) return sanitizedUrl(value);
  return redactAttemptEvidence(value);
}

function urlScheme(value: string): string | undefined {
  const colon = value.indexOf(":");
  if (colon === -1) return undefined;
  const firstPathDelimiter = value.search(/[/?#]/);
  if (firstPathDelimiter !== -1 && firstPathDelimiter < colon) return undefined;
  const scheme = Array.from(value.slice(0, colon))
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 0x20 && code !== 0x7f;
    })
    .join("")
    .toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : "invalid";
}

function redactUrlUserInfo(value: string): string | undefined {
  const protocolRelative = value.startsWith("//");
  try {
    const url = new URL(protocolRelative ? `https:${value}` : value);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    const serialized = url.toString();
    return protocolRelative ? serialized.slice("https:".length) : serialized;
  } catch {
    return undefined;
  }
}

function sanitizedUrl(value: string): string | undefined {
  let leadingCharacters = 0;
  while (leadingCharacters < value.length) {
    const code = value.codePointAt(leadingCharacters) ?? 0;
    if (code > 0x20 && code !== 0x7f) break;
    leadingCharacters += 1;
  }
  const normalizedValue = value.slice(leadingCharacters);
  const scheme = urlScheme(normalizedValue);
  if (scheme !== undefined && !allowedUrlSchemes.has(scheme)) return undefined;
  const withRedactedUserInfo =
    scheme === "http" || scheme === "https" || normalizedValue.startsWith("//")
      ? redactUrlUserInfo(normalizedValue)
      : normalizedValue;
  return withRedactedUserInfo === undefined
    ? undefined
    : redactAttemptEvidence(withRedactedUserInfo);
}

function serializedStartTag(element: Element): string {
  const attributes = Object.entries(element.attrs ?? {}).flatMap(
    ([name, value]) => {
      if (!validName.test(name) || typeof value !== "string") return [];
      const sanitized = sanitizedAttributeValue(element, name, value);
      return sanitized === undefined
        ? []
        : [` ${name}="${escapeHtml(sanitized)}"`];
    },
  );
  return `<${element.tag.toLowerCase()}${attributes.join("")}>`;
}

type VisitState = { depth: number; redactText: boolean; reservedBytes: number };

export function serializeSnapshotToHtml(root: Node): {
  html: string;
  truncated: boolean;
} {
  const writer = new HtmlWriter();
  let nodes = 0;

  const visit = (node: Node, state: VisitState) => {
    if (writer.stopped) return;
    nodes += 1;
    if (nodes > maxHtmlNodes || state.depth > maxHtmlDepth) {
      writer.stopped = true;
      writer.truncated = true;
      return;
    }
    if (typeof node === "string") {
      writer.appendText(
        escapeHtml(
          state.redactText ? "[REDACTED]" : redactAttemptEvidence(node),
        ),
        state.reservedBytes,
      );
      return;
    }
    const normalizedTag = node.tag.toUpperCase();
    if (omittedTags.has(normalizedTag)) return;
    if (!validName.test(node.tag)) {
      writer.truncated = true;
      for (const child of node.children) visit(child, state);
      return;
    }
    const closingTag = `</${node.tag.toLowerCase()}>`;
    const childState = {
      depth: state.depth + 1,
      redactText: state.redactText || normalizedTag === "TEXTAREA",
      reservedBytes: state.reservedBytes + Buffer.byteLength(closingTag),
    };
    if (!writer.append(serializedStartTag(node), childState.reservedBytes))
      return;
    for (const child of node.children) {
      visit(child, childState);
      if (writer.stopped) break;
    }
    const wasStopped = writer.stopped;
    writer.stopped = false;
    writer.append(closingTag, state.reservedBytes);
    writer.stopped ||= wasStopped;
  };

  visit(root, { depth: 0, redactText: false, reservedBytes: 0 });
  return { html: writer.chunks.join(""), truncated: writer.truncated };
}
