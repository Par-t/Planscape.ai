"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  ConnectionLineType,
  MarkerType,
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
import CustomNode from "./custom-node";
import CustomEdge from "./custom-edge";

export interface NodeAnnotation {
  status: "ok" | "warning" | "error";
  reasons: string[];
}

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  nodeAnnotations?: Record<string, NodeAnnotation>;
  onAnnotationClick?: (info: { nodeId: string; label: string; status: "ok" | "warning" | "error"; reasons: string[] }) => void;
  onBeforeChange?: () => void;
}

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const defaultEdgeOptions = {
  type: "custom",
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
  style: { stroke: "#6366f1", strokeWidth: 3 },
};

export default function GraphView({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onDeleteNode,
  onDeleteEdge,
  nodeAnnotations,
  onAnnotationClick,
  onBeforeChange,
}: GraphViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Graph will appear here
      </div>
    );
  }

  // Enrich nodes with delete callback and annotation data
  const enrichedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onDelete: onDeleteNode,
          onAnnotationClick,
          annotation: nodeAnnotations?.[n.id],
        },
      })),
    [nodes, onDeleteNode, onAnnotationClick, nodeAnnotations]
  );

  // Enrich edges with delete callback
  const enrichedEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: "custom",
        data: { ...e.data, onDelete: onDeleteEdge },
      })),
    [edges, onDeleteEdge]
  );

  const handleNodesChange = (changes: NodeChange[]) => {
    onNodesChange(applyNodeChanges(changes, nodes));
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    onEdgesChange(applyEdgeChanges(changes, edges));
  };

  const handleConnect = (connection: Connection) => {
    onBeforeChange?.();
    const newEdge: Edge = {
      ...connection,
      id: `${connection.source}-${connection.target}-${connection.sourceHandle ?? "s"}-${connection.targetHandle ?? "t"}`,
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 3 },
      type: "custom",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
    } as Edge;
    onEdgesChange(addEdge(newEdge, edges));
  };

  return (
    <ReactFlow
      nodes={enrichedNodes}
      edges={enrichedEdges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      onNodeDragStart={() => onBeforeChange?.()}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      connectionLineStyle={{ stroke: "#6366f1", strokeWidth: 3 }}
      connectionLineType={ConnectionLineType.SmoothStep}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={true}
      nodesConnectable={true}
      elementsSelectable={true}
      minZoom={0.01}
      deleteKeyCode="Backspace"
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#27272a" gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
