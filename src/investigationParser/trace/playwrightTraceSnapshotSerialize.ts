// oxlint-disable eslint/max-lines -- Keep the bounded snapshot traversal aligned with the platform reader; splitting its recursive state would obscure the shared budget.

import {
  type SnapshotSerialization,
  BoundedJsonWriter,
} from "./playwrightTraceSnapshotWriter.js";

export function serializeSnapshotHtml({
  filterStyles,
  maxBytes,
  maxDepth = 128,
  maxNodes = 50_000,
  snapshotIndex,
  snapshots,
}: {
  filterStyles: boolean;
  maxBytes: number;
  maxDepth?: number;
  maxNodes?: number;
  snapshotIndex: number;
  snapshots: unknown[];
}): SnapshotSerialization {
  const writer = new BoundedJsonWriter(maxBytes);
  const indexes = new Map<number, unknown[]>();
  let visitedNodes = 0;

  const enterNode = (depth: number) => {
    visitedNodes += 1;
    if (visitedNodes > maxNodes || depth > maxDepth) {
      writer.stop();
      return false;
    }
    return true;
  };

  const snapshotNodes = (index: number): unknown[] => {
    const cached = indexes.get(index);
    if (cached) return cached;
    const nodes: unknown[] = [];
    const pending: { depth: number; expanded: boolean; node: unknown }[] = [
      { depth: 0, expanded: false, node: snapshots[index] },
    ];
    while (pending.length && !writer.truncated) {
      const current = pending.pop();
      if (!current || !enterNode(current.depth)) break;
      if (typeof current.node === "string") {
        nodes.push(current.node);
        continue;
      }
      if (!Array.isArray(current.node) || typeof current.node[0] !== "string")
        continue;
      if (current.expanded) {
        nodes.push(current.node);
        continue;
      }
      pending.push({ ...current, expanded: true });
      current.node
        .slice(2)
        .reverse()
        .forEach((node) =>
          pending.push({
            depth: current.depth + 1,
            expanded: false,
            node,
          }),
        );
    }
    indexes.set(index, nodes);
    return nodes;
  };

  const appendString = (value: string, prefix: string) => {
    const prefixBytes = Buffer.byteLength(prefix);
    if (Buffer.byteLength(value) + 2 > writer.remainingBytes - prefixBytes) {
      writer.stop();
      return false;
    }
    return writer.append(`${prefix}${JSON.stringify(value)}`);
  };

  const serializeRaw = (
    value: unknown,
    depth: number,
    prefix: string,
  ): boolean => {
    if (!enterNode(depth)) return false;
    if (typeof value === "string") return appendString(value, prefix);
    if (value === null || typeof value !== "object") {
      const serialized = JSON.stringify(value) ?? "null";
      return writer.append(`${prefix}${serialized}`);
    }
    if (Array.isArray(value)) {
      if (!writer.append(`${prefix}[`)) return false;
      value.forEach((child, index) => {
        if (!writer.truncated)
          serializeRaw(child, depth + 1, index === 0 ? "" : ",");
      });
      return writer.append("]");
    }
    if (!writer.append(`${prefix}{`)) return false;
    let propertyCount = 0;
    Object.entries(value).forEach(([key, child]) => {
      if (writer.truncated || child === undefined) return;
      const separator = propertyCount === 0 ? "" : ",";
      if (!appendString(key, separator) || !writer.append(":")) return;
      propertyCount += 1;
      serializeRaw(child, depth + 1, "");
    });
    return writer.append("}");
  };

  const serialize = (
    value: unknown,
    { depth, index, prefix }: { depth: number; index: number; prefix: string },
  ): boolean => {
    if (!enterNode(depth)) return false;
    const reference =
      Array.isArray(value) && value.length === 1 && Array.isArray(value[0])
        ? value[0]
        : undefined;
    if (
      reference &&
      typeof reference[0] === "number" &&
      typeof reference[1] === "number"
    ) {
      const targetIndex = index - reference[0];
      return serialize(
        targetIndex < 0 ? "" : snapshotNodes(targetIndex)[reference[1]],
        { depth: depth + 1, index: targetIndex, prefix },
      );
    }
    if (!Array.isArray(value)) return serializeRaw(value, depth + 1, prefix);
    const isElement = typeof value[0] === "string";
    if (
      filterStyles &&
      isElement &&
      (value[0] === "STYLE" || value[0] === "SCRIPT" || value[0] === "NOSCRIPT")
    )
      return false;
    if (!writer.append(`${prefix}[`)) return false;
    serializeRaw(value[0], depth + 1, "");
    if (!writer.truncated) {
      writer.append(",");
      const array: unknown[] = value;
      const attributes = array[1];
      const filteredAttributes =
        filterStyles &&
        isElement &&
        typeof attributes === "object" &&
        attributes !== null &&
        !Array.isArray(attributes)
          ? Object.fromEntries(
              Object.entries(attributes).filter(([name]) => name !== "style"),
            )
          : attributes;
      serializeRaw(filteredAttributes, depth + 1, "");
    }
    const array: unknown[] = value;
    array.slice(2).forEach((child) => {
      if (!writer.truncated)
        serialize(child, { depth: depth + 1, index, prefix: "," });
    });
    return writer.append("]");
  };

  serialize(snapshots[snapshotIndex], {
    depth: 0,
    index: snapshotIndex,
    prefix: "",
  });
  return writer.finish();
}
