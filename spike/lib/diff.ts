import { Node, Edge } from "reactflow";

export interface GraphSnapshot {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string }[];
}

export function snapshotFromFlow(nodes: Node[], edges: Edge[]): GraphSnapshot {
  return {
    nodes: nodes.map((n) => ({ id: n.id, label: n.data.label as string })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

export function diffGraphs(prev: GraphSnapshot, curr: GraphSnapshot): string[] {
  const changes: string[] = [];

  const prevNodeIds = new Set(prev.nodes.map((n) => n.id));
  const currNodeIds = new Set(curr.nodes.map((n) => n.id));
  const prevNodeMap = Object.fromEntries(prev.nodes.map((n) => [n.id, n.label]));
  const currNodeMap = Object.fromEntries(curr.nodes.map((n) => [n.id, n.label]));

  // Deleted nodes
  for (const id of prevNodeIds) {
    if (!currNodeIds.has(id)) {
      changes.push(`Deleted node: "${prevNodeMap[id]}"`);
    }
  }

  // Added nodes
  for (const id of currNodeIds) {
    if (!prevNodeIds.has(id)) {
      changes.push(`Added node: "${currNodeMap[id]}"`);
    }
  }

  const edgeKey = (e: { source: string; target: string }) => `${e.source}→${e.target}`;
  const prevEdgeKeys = new Set(prev.edges.map(edgeKey));
  const currEdgeKeys = new Set(curr.edges.map(edgeKey));

  // Removed edges
  for (const e of prev.edges) {
    if (!currEdgeKeys.has(edgeKey(e))) {
      const src = prevNodeMap[e.source] ?? e.source;
      const tgt = prevNodeMap[e.target] ?? e.target;
      changes.push(`Removed dependency: "${src}" → "${tgt}"`);
    }
  }

  // Added edges
  for (const e of curr.edges) {
    if (!prevEdgeKeys.has(edgeKey(e))) {
      const src = currNodeMap[e.source] ?? e.source;
      const tgt = currNodeMap[e.target] ?? e.target;
      changes.push(`Added dependency: "${src}" → "${tgt}"`);
    }
  }

  return changes;
}
