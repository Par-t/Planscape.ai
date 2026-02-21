"use client";

import { useState, useRef, useEffect } from "react";
import { useCopilotAction, useCopilotReadable, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { Node, Edge } from "reactflow";
import GraphView from "@/components/graph-view";
import InsightPanel from "@/components/insight-panel";
import { applyDagreLayout } from "@/lib/graph-layout";
import { snapshotFromFlow, diffGraphs, describeGraph, GraphSnapshot } from "@/lib/diff";
import { v4 as uuidv4 } from "uuid";

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

const nodeStyle = {
  background: "#1e1e2e",
  color: "#e2e8f0",
  border: "1px solid #6366f1",
  borderRadius: "8px",
  padding: "10px 16px",
  fontSize: "13px",
  fontWeight: 500,
  width: 180,
};

const nodeStyleWarning = { ...nodeStyle, border: "1px solid #f59e0b" };
const nodeStyleError = { ...nodeStyle, border: "1px solid #ef4444" };
const nodeStyleOk = { ...nodeStyle, border: "1px solid #10b981" };

export default function Home() {
  const [planText, setPlanText] = useState(TEST_PLAN);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return uuidv4();
    const stored = localStorage.getItem("minui-session-id");
    if (stored) return stored;
    const id = uuidv4();
    localStorage.setItem("minui-session-id", id);
    return id;
  });

  const confirmedGraph = useRef<GraphSnapshot | null>(null);
  const checkCountRef = useRef(0);
  const planTextRef = useRef(planText);
  planTextRef.current = planText;

  const { appendMessage } = useCopilotChat();

  useEffect(() => {
    if (!confirmedGraph.current || nodes.length === 0) return;
    const current = snapshotFromFlow(nodes, edges);
    const changes = diffGraphs(confirmedGraph.current, current);
    setHasChanges(changes.length > 0);
  }, [nodes, edges]);

  useCopilotReadable({
    description: "Current graph nodes and edges",
    value: { nodes: nodes.map((n) => ({ id: n.id, label: n.data.label })), edges },
  });

  useCopilotReadable({
    description: "Unique session ID for memory persistence",
    value: sessionId,
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
        style: nodeStyle,
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
      setWarnings([]);
      setSuggestions([]);
      setHasChanges(false);
      confirmedGraph.current = snapshotFromFlow(laid, flowEdges);
    },
  });

  useCopilotAction({
    name: "flagNode",
    description:
      "Flag a node with a status color. Call once per node that needs a status update. " +
      "'ok' = green (node is fine), 'warning' = amber (potential issue), " +
      "'error' = red (definite problem). Include a brief reason.",
    parameters: [
      { name: "nodeId", type: "string", description: "The ID of the node to flag", required: true },
      { name: "status", type: "string", description: "ok | warning | error", required: true },
      { name: "reason", type: "string", description: "Brief explanation of why this status was assigned", required: true },
    ],
    handler: ({ nodeId, status, reason }: { nodeId: string; status: "ok" | "warning" | "error"; reason: string }) => {
      console.log(`[flagNode] nodeId=${nodeId}, status=${status}, reason=${reason}`);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                style:
                  status === "error" ? nodeStyleError
                  : status === "warning" ? nodeStyleWarning
                  : nodeStyleOk,
              }
            : n
        )
      );
      return `Flagged "${nodeId}" as ${status}: ${reason}`;
    },
  });

  useCopilotAction({
    name: "addInsight",
    description:
      "Add a warning or suggestion to the insight panel. " +
      "Use 'warning' for problems found, 'suggestion' for helpful observations.",
    parameters: [
      { name: "type", type: "string", description: "warning | suggestion", required: true },
      { name: "message", type: "string", description: "The insight message to display", required: true },
    ],
    handler: ({ type, message }: { type: "warning" | "suggestion"; message: string }) => {
      console.log(`[addInsight] type=${type}, message=${message}`);
      if (type === "warning") {
        setWarnings((prev) => [...prev, message]);
      } else {
        setSuggestions((prev) => [...prev, message]);
      }
      return `Added ${type}: "${message}"`;
    },
  });

  const handleGenerate = async () => {
    if (!planText.trim()) return;
    setLoading(true);
    setNodes([]);
    setEdges([]);
    confirmedGraph.current = null;
    await appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: `Here is the plan to analyze:\n\n${planText}`,
      })
    );
  };

  const handleCheckChanges = async () => {
    if (!confirmedGraph.current) return;
    const current = snapshotFromFlow(nodes, edges);
    const changes = diffGraphs(confirmedGraph.current, current);
    if (changes.length === 0) return;

    setChecking(true);
    setWarnings([]);
    setSuggestions([]);

    // Reset node styles to default before Claude flags them
    setNodes((prev) => prev.map((n) => ({ ...n, style: nodeStyle })));

    checkCountRef.current += 1;
    const checkNum = checkCountRef.current;

    try {
      await appendMessage(
        new TextMessage({
          role: MessageRole.User,
          content: `You are a plan dependency analyzer. I have a plan and a dependency graph. I just made edits to the graph. Analyze my changes.

SESSION ID: ${sessionId}
CHECK NUMBER: ${checkNum}

ORIGINAL PLAN:
${planTextRef.current}

PREVIOUS GRAPH:
${describeGraph(confirmedGraph.current)}

CURRENT GRAPH (after my edits):
${describeGraph(current)}

CHANGES MADE:
${changes.map((c, i) => `${i + 1}. ${c}`).join("\n")}

INSTRUCTIONS:
1. If memory tools are available, call search_long_term_memory with query "session ${sessionId} analysis" to check for past context.
2. Analyze whether my changes break dependencies or create logical problems.
3. For each affected node, call flagNode with the appropriate status ("ok", "warning", or "error") and a reason.
4. Call addInsight for each warning or suggestion (max 2 warnings, max 2 suggestions).
5. If memory tools are available, call create_long_term_memory to store a brief summary: "Session ${sessionId} Check ${checkNum}: [your summary]"
6. If past analysis exists, note repeated patterns and escalate severity.
7. Do NOT respond with plain text. Only use the tool calls above.`,
        })
      );

      confirmedGraph.current = current;
      setHasChanges(false);
    } catch {
      setWarnings(["Failed to reach Claude. Is the server running?"]);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Plan → Graph</h1>
        <p className="text-zinc-400 text-sm">Paste a plan, Claude extracts the dependency graph. Edit it, then check your changes.</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-zinc-800 flex flex-col p-4 gap-4">
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
          <GraphView
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
          />
        </div>

        <InsightPanel
          warnings={warnings}
          suggestions={suggestions}
          checking={checking}
          hasChanges={hasChanges}
          onCheck={handleCheckChanges}
        />
      </div>
    </div>
  );
}
