"use client";

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
}

export default function GraphView({ nodes, edges, onNodesChange, onEdgesChange }: GraphViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Graph will appear here
      </div>
    );
  }

  const handleNodesChange = (changes: NodeChange[]) => {
    onNodesChange(applyNodeChanges(changes, nodes));
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    onEdgesChange(applyEdgeChanges(changes, edges));
  };

  const handleConnect = (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `${connection.source}-${connection.target}`,
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 2 },
      type: "smoothstep",
    } as Edge;
    onEdgesChange(addEdge(newEdge, edges));
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={true}
      nodesConnectable={true}
      elementsSelectable={true}
      deleteKeyCode="Backspace"
    >
      <Background color="#27272a" gap={20} />
      <Controls />
      <MiniMap nodeColor="#6366f1" maskColor="rgba(0,0,0,0.6)" />
    </ReactFlow>
  );
}
