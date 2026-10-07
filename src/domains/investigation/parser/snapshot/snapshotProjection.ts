// oxlint-disable eslint/max-lines -- Keep snapshot resolution and text projection aligned with the platform implementation.

import { reconstructSnapshotHtml } from "~/domains/investigation/parser/trace/playwrightTraceSnapshots.js";

// Playwright stores a page snapshot as nested arrays: a text node is a
// string, an element is [tag, attributes, ...children], and [[back, index]]
// points at a node of an earlier snapshot of the same frame, `back`
// snapshots before this one, at position `index` in post-order.
type ElementArray = [string, ...RawNode[]];
type RawNode = null | string | ElementArray | Record<string, string>;

export type Element = {
  attrs: Record<string, string>;
  children: Node[];
  tag: string;
};
export type Node = string | Element;

import {
  shownAttributes,
  shownTags,
  skippedTags,
} from "./snapshotVocabulary.js";

const isElementArray = (node: unknown): node is ElementArray =>
  Array.isArray(node) && typeof node[0] === "string";

/** Resolves the references of one snapshot against the earlier ones of the same frame. */
export function resolveSnapshot(
  frameSnapshots: unknown[],
  index: number,
): Node {
  const visit = (node: unknown): Node => {
    if (typeof node === "string") return node;
    if (!isElementArray(node)) return "";
    const [tag, second, ...rest] = node;
    const hasAttrsSlot =
      second === null ||
      (second !== undefined &&
        typeof second === "object" &&
        !Array.isArray(second));
    const attrs = hasAttrsSlot && second !== null ? second : {};
    const children = hasAttrsSlot
      ? rest
      : second === undefined
        ? []
        : [second, ...rest];
    return {
      attrs,
      children: children.map((child) => visit(child)),
      tag,
    };
  };

  const root = reconstructSnapshotHtml(frameSnapshots, index);
  return root === undefined ? "" : visit(root);
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function textOf(node: Node): string {
  return typeof node === "string" ? node : node.children.map(textOf).join(" ");
}

type Projection = {
  depth: number;
  lines: string[];
  max: number;
  redactText: boolean;
};

/** A compact, model-readable projection: landmarks, controls, and text. */
function project(node: Node, projection: Projection) {
  const { depth, lines, max } = projection;
  if (lines.length >= max) return;
  if (typeof node === "string") {
    const text = projection.redactText ? "[REDACTED]" : collapse(node);
    if (text) lines.push(`${"  ".repeat(depth)}${text}`);
    return;
  }
  if (skippedTags.has(node.tag)) return;
  const shown = shownTags.has(node.tag);
  if (shown) {
    const attrs = shownAttributes
      .filter((name) => node.attrs[name] !== undefined)
      .map((name) => ` ${name}="${node.attrs[name] ?? ""}"`)
      .join("");
    lines.push(`${"  ".repeat(depth)}<${node.tag.toLowerCase()}${attrs}>`);
  }
  node.children.forEach((child) =>
    project(child, {
      depth: depth + (shown ? 1 : 0),
      lines,
      max,
      redactText: projection.redactText || node.tag === "TEXTAREA",
    }),
  );
}

export function projectToText(node: Node, max: number): string {
  const lines: string[] = [];
  project(node, { depth: 0, lines, max, redactText: false });
  return lines.join("\n");
}

export function findSmallestTextRegions(root: Node, query: string): Node[] {
  const find = (node: Node, parent: Element | undefined): Element[] => {
    if (typeof node === "string") return [];
    const childMatches = node.children.flatMap((child) => find(child, node));
    if (childMatches.length) return childMatches;
    return collapse(textOf(node)).toLowerCase().includes(query.toLowerCase())
      ? [parent ?? node]
      : [];
  };
  return [...new Set(find(root, undefined))];
}
