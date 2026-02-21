"use client";

import { useState } from "react";
import { useCopilotAction, useCopilotReadable, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { Node, Edge } from "reactflow";
import GraphView from "@/components/graph-view";
import { applyDagreLayout } from "@/lib/graph-layout";

const TEST_PLAN = `We need to collect training data, then clean and preprocess it.
While that's happening, we can set up the ML infrastructure.
Once data is ready and infra is up, we train the model.
After training, we validate results, and if good, deploy to production.
Monitoring should be set up before deployment.`;

interface RawNode {
  id: string;
  label: string;
}

interface RawEdge {
  source: string;
  target: string;
}

export default function Home() {
  const [planText, setPlanText] = useState(TEST_PLAN);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);

  const { appendMessage } = useCopilotChat();

  useCopilotReadable({
    description: "Current graph nodes and edges",
    value: { nodes: nodes.map((n) => ({ id: n.id, label: n.data.label })), edges },
  });

  useCopilotAction({
    name: "createGraph",
    description: "Extract steps from the user's plan and create a dependency graph. Max 8 nodes. Each node label must be 3-5 words. Add an edge from A to B only if B cannot start until A is complete. Steps that can run in parallel should share a common parent edge but have no edge between them. Call this action immediately when the user provides a plan — do not respond in text.",
    parameters: [
      {
        name: "nodes",
        type: "object[]",
        description: "Array of nodes with id and label",
        attributes: [
          { name: "id", type: "string", description: "Unique node identifier" },
          { name: "label", type: "string", description: "Node display label (3-5 words)" },
        ],
      },
      {
        name: "edges",
        type: "object[]",
        description: "Array of directed edges showing dependencies",
        attributes: [
          { name: "source", type: "string", description: "Source node id" },
          { name: "target", type: "string", description: "Target node id" },
        ],
      },
    ],
    handler: ({ nodes: rawNodes, edges: rawEdges }: { nodes: RawNode[]; edges: RawEdge[] }) => {
      const flowNodes: Node[] = rawNodes.map((n) => ({
        id: n.id,
        data: { label: n.label },
        position: { x: 0, y: 0 },
        style: {
          background: "#1e1e2e",
          color: "#e2e8f0",
          border: "1px solid #6366f1",
          borderRadius: "8px",
          padding: "10px 16px",
          fontSize: "13px",
          fontWeight: 500,
          width: 180,
        },
      }));

      const flowEdges: Edge[] = rawEdges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
        type: "smoothstep",
      }));

      const laid = applyDagreLayout(flowNodes, flowEdges);
      setNodes(laid);
      setEdges(flowEdges);
      setLoading(false);
    },
  });

  const handleGenerate = async () => {
    if (!planText.trim()) return;
    setLoading(true);
    setNodes([]);
    setEdges([]);
    await appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: `Here is the plan to analyze:\n\n${planText}`,
      })
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Plan → Graph</h1>
        <p className="text-zinc-400 text-sm">Paste a plan, Claude extracts the dependency graph</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-96 border-r border-zinc-800 flex flex-col p-4 gap-4">
          <textarea
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-indigo-500 font-mono"
            placeholder="Paste your plan here..."
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "Analyzing..." : "Generate Graph →"}
          </button>
        </div>

        <div className="flex-1 bg-zinc-900">
          <GraphView nodes={nodes} edges={edges} />
        </div>
      </div>
    </div>
  );
}
