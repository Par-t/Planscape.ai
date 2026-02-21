import dagre from "@dagrejs/dagre";
import { Node, Edge } from "reactflow";

export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 200, ranksep: 250, edgesep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 585, height: 135 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return {
      ...node,
      position: { x: x - 292, y: y - 67 },
    };
  });
}
