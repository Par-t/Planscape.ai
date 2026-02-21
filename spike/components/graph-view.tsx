"use client";

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
}

export default function GraphView({ nodes, edges }: GraphViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Graph will appear here
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
    >
      <Background color="#27272a" gap={20} />
      <Controls />
      <MiniMap nodeColor="#6366f1" maskColor="rgba(0,0,0,0.6)" />
    </ReactFlow>
  );
}
