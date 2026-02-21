"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCopilotAction, useCopilotReadable, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { Node, Edge, MarkerType } from "reactflow";
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
  background: "linear-gradient(135deg, #1e1e2e 0%, #1a1a2e 100%)",
  color: "#e2e8f0",
  border: "2px solid #6366f1",
  borderRadius: "16px",
  padding: "30px 45px",
  fontSize: "39px",
  fontWeight: 600,
  width: 585,
  boxShadow: "0 4px 24px rgba(99, 102, 241, 0.08)",
};

const nodeStyleWarning = { ...nodeStyle, border: "2px solid #f59e0b", boxShadow: "0 4px 24px rgba(245, 158, 11, 0.1)" };
const nodeStyleError = { ...nodeStyle, border: "2px solid #ef4444", boxShadow: "0 4px 24px rgba(239, 68, 68, 0.1)" };
const nodeStyleOk = { ...nodeStyle, border: "2px solid #10b981", boxShadow: "0 4px 24px rgba(16, 185, 129, 0.1)" };

export default function Home() {
  const [planText, setPlanText] = useState(TEST_PLAN);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [checkSummary, setCheckSummary] = useState("");
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [nodeAnnotations, setNodeAnnotations] = useState<
    Record<string, { status: "ok" | "warning" | "error"; reasons: string[] }>
  >({});
  const [activeAnnotation, setActiveAnnotation] = useState<{
    nodeId: string;
    label: string;
    status: "ok" | "warning" | "error";
    reasons: string[];
  } | null>(null);

  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyLen, setHistoryLen] = useState(0);

  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-29), { nodes, edges }];
    setHistoryLen(historyRef.current.length);
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const last = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryLen(historyRef.current.length);
    setNodes(last.nodes);
    setEdges(last.edges);
  }, []);

  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return uuidv4();
    const stored = localStorage.getItem("planscape-session-id");
    if (stored) return stored;
    const id = uuidv4();
    localStorage.setItem("planscape-session-id", id);
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

  // Ctrl/Cmd+Z undo shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

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
        type: "custom",
        data: { label: n.label, nodeStyle },
        position: { x: 0, y: 0 },
      }));

      const flowEdges: Edge[] = rawEdges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 3 },
        type: "custom",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
      }));

      const laid = applyDagreLayout(flowNodes, flowEdges);
      pushHistory();
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
    handler: ({ nodeId, status: rawStatus, reason }: { nodeId: string; status: string; reason: string }) => {
      const status = rawStatus as "ok" | "warning" | "error";
      console.log(`[flagNode] nodeId=${nodeId}, status=${status}, reason=${reason}`);
      const statusPriority: Record<string, number> = { error: 3, warning: 2, ok: 1 };
      const styleForStatus = (s: "ok" | "warning" | "error") =>
        s === "error" ? nodeStyleError : s === "warning" ? nodeStyleWarning : nodeStyleOk;

      // Accumulate annotation first to determine the highest-priority status
      setNodeAnnotations((prev) => {
        const existing = prev[nodeId];
        const resolvedStatus = existing
          ? (statusPriority[status] > statusPriority[existing.status] ? status : existing.status)
          : status;
        // Apply node style matching the resolved (highest-priority) status
        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, nodeStyle: styleForStatus(resolvedStatus) } }
              : n
          )
        );
        return {
          ...prev,
          [nodeId]: {
            status: resolvedStatus,
            reasons: existing ? [...existing.reasons, reason] : [reason],
          },
        };
      });
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
    handler: ({ type, message }: { type: string; message: string }) => {
      console.log(`[addInsight] type=${type}, message=${message}`);
      if (type === "warning") {
        setWarnings((prev) => [...prev, message]);
      } else {
        setSuggestions((prev) => [...prev, message]);
      }
      return `Added ${type}: "${message}"`;
    },
  });

  useCopilotAction({
    name: "summarizeCheck",
    description:
      "Provide a brief overall summary of the check results for the side panel. " +
      "Summarize what changed in the flowchart, how it affected the flow, and the overall health. " +
      "Keep it to 2-3 short sentences. Always call this once at the end of your analysis.",
    parameters: [
      { name: "summary", type: "string", description: "A brief 2-3 sentence summary of the check results", required: true },
    ],
    handler: ({ summary }: { summary: string }) => {
      console.log(`[summarizeCheck] ${summary}`);
      setCheckSummary(summary);
      return `Summary set.`;
    },
  });

  useCopilotAction({
    name: "storeMemory",
    description:
      "Store a memory in long-term storage (Redis). Use this to persist analysis summaries " +
      "so they can be recalled in future checks. Always call this after analyzing changes.",
    parameters: [
      { name: "text", type: "string", description: "The memory text to store (include session ID and check number)", required: true },
    ],
    handler: async ({ text }: { text: string }) => {
      console.log(`[storeMemory] ${text}`);
      try {
        const res = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "store", text }),
        });
        const data = await res.json();
        return data.ok ? `Memory stored: "${text}"` : `Failed to store: ${data.error}`;
      } catch (e) {
        return `Failed to store memory: ${e}`;
      }
    },
  });

  useCopilotAction({
    name: "searchMemory",
    description:
      "Search long-term memory (Redis) for past analysis context. " +
      "Call this before analyzing changes to check for recurring patterns.",
    parameters: [
      { name: "query", type: "string", description: "Search query (e.g. 'session <id> analysis')", required: true },
    ],
    handler: async ({ query }: { query: string }) => {
      console.log(`[searchMemory] query=${query}`);
      try {
        const res = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search", query }),
        });
        const data = await res.json();
        return data.ok ? data.result : `Search failed: ${data.error}`;
      } catch (e) {
        return `Search failed: ${e}`;
      }
    },
  });

  const [expanding, setExpanding] = useState(false);

  const handleExpand = async () => {
    if (!planText.trim()) return;
    setExpanding(true);
    try {
      const res = await fetch("/api/elaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planText }),
      });
      const data = await res.json();
      if (data.ok && data.plan) {
        setPlanText(data.plan);
      }
    } catch {
      // silently fail
    } finally {
      setExpanding(false);
    }
  };

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
    setNodeAnnotations({});
    setCheckSummary("");

    // Reset node styles to default before Claude flags them
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, nodeStyle } })));

    checkCountRef.current += 1;
    const checkNum = checkCountRef.current;

    try {
      await appendMessage(
        new TextMessage({
          role: MessageRole.User,
          content: `You are reviewing edits to a flowchart that represents a project plan. Think of this as a visual flowchart where each box is a step and arrows show what must happen before what.

SESSION ID: ${sessionId}
CHECK NUMBER: ${checkNum}

ORIGINAL PLAN:
${planTextRef.current}

PREVIOUS FLOWCHART:
${describeGraph(confirmedGraph.current)}

CURRENT FLOWCHART (after edits):
${describeGraph(current)}

CHANGES MADE:
${changes.map((c, i) => `${i + 1}. ${c}`).join("\n")}

INSTRUCTIONS:
1. Call searchMemory with query "session ${sessionId} analysis" to check for past context.
2. Analyze whether the edits break the logical flow of the plan. Think in terms of the flowchart: does the sequence of steps still make sense? Are there steps that now have no path leading to them? Are there steps that lost a prerequisite they need?
3. For each affected step, call flagNode with the appropriate status ("ok", "warning", or "error") and a SHORT, plain-language reason (1 sentence max). Write reasons as if explaining to a non-technical person looking at a flowchart. Say things like "This step has no arrow leading into it, so nothing triggers it" or "Removing X means Y has no input" — NOT graph theory terms like nodes, leaves, edges, trees, or orphans.
4. Call addInsight for each warning or suggestion (max 2 each). Keep these practical and flowchart-oriented.
5. Call summarizeCheck with a brief 2-3 sentence overview of what changed and how it affects the flow.
6. Call storeMemory to persist a summary: "Session ${sessionId} Check ${checkNum}: [your summary of what changed and what you flagged]"
7. If past analysis exists from searchMemory, note repeated patterns and escalate severity.
8. Do NOT respond with plain text. Only use the tool calls above.`,
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

  const handleAddNode = () => {
    if (!newNodeLabel.trim()) return;
    const id = `node-${Date.now()}`;
    const lastNode = nodes[nodes.length - 1];
    const position = lastNode
      ? { x: lastNode.position.x + 220, y: lastNode.position.y }
      : { x: 100, y: 100 };

    pushHistory();
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "custom",
        data: { label: newNodeLabel.trim(), nodeStyle },
        position,
      },
    ]);
    setNewNodeLabel("");
    setShowAddNode(false);
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    pushHistory();
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [pushHistory]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    pushHistory();
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, [pushHistory]);

  const handleAnnotationClick = useCallback((info: { nodeId: string; label: string; status: "ok" | "warning" | "error"; reasons: string[] }) => {
    setActiveAnnotation(info);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="border-b border-zinc-800/50 px-6 py-5 header-glow">
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gradient">
              Planscape.ai
            </h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              Your plans are a mess. Let&apos;s untangle them.
            </p>
          </div>
        </div>
      </div>

      {/* Add Node Modal */}
      {showAddNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl shadow-black/50">
            <h2 className="text-sm font-semibold text-zinc-100">Add a new step</h2>
            <input
              type="text"
              autoFocus
              value={newNodeLabel}
              onChange={(e) => setNewNodeLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddNode();
                if (e.key === "Escape") { setShowAddNode(false); setNewNodeLabel(""); }
              }}
              placeholder="Enter step name..."
              className="bg-zinc-800 border border-zinc-600/50 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none textarea-glow"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddNode(false); setNewNodeLabel(""); }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNode}
                disabled={!newNodeLabel.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl px-4 py-1.5 text-xs font-semibold transition-all btn-glow"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Annotation Detail Dialog */}
      {activeAnnotation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setActiveAnnotation(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setActiveAnnotation(null); }}
        >
          <div
            className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-12 w-[720px] max-h-[75vh] flex flex-col gap-6 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-full flex-shrink-0"
                style={{
                  background: activeAnnotation.status === "error" ? "#ef4444"
                    : activeAnnotation.status === "warning" ? "#f59e0b"
                    : "#10b981",
                }}
              />
              <h2 className="text-2xl font-semibold text-zinc-100 truncate">
                {activeAnnotation.label}
              </h2>
              <span className="text-base text-zinc-400 ml-auto font-medium">
                {activeAnnotation.status.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto">
              {activeAnnotation.reasons.map((r, i) => (
                <div
                  key={i}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 text-base text-zinc-200 leading-relaxed"
                >
                  {r}
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveAnnotation(null)}
              className="self-end px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-zinc-800/50 flex flex-col p-4 gap-3">
          <textarea
            className="flex-1 bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none textarea-glow font-mono leading-relaxed"
            placeholder={"Paste your grand plan here...\n(We promise not to judge. Much.)"}
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
          />
          <button
            onClick={handleExpand}
            disabled={expanding || loading || !planText.trim()}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 hover:text-white rounded-xl py-2 text-sm font-medium transition-all border border-zinc-700/50"
          >
            {expanding ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5 spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                Rephrasing...
              </span>
            ) : (
              "Rephrase it"
            )}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all btn-glow"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                Claude is thinking...
              </span>
            ) : (
              "Generate Graph"
            )}
          </button>
        </div>

        <div className="flex-1 bg-zinc-900 relative">
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            {historyLen > 0 && (
              <button
                onClick={handleUndo}
                className="bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl px-3 py-2 text-sm font-medium transition-all shadow-lg backdrop-blur-sm border border-zinc-700/50 flex items-center gap-1.5"
                title="Undo (Ctrl+Z)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Undo
              </button>
            )}
            <button
              onClick={() => setShowAddNode(true)}
              disabled={nodes.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-lg btn-glow"
            >
              + Add Step
            </button>
          </div>
          <GraphView
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
            nodeAnnotations={nodeAnnotations}
            onAnnotationClick={handleAnnotationClick}
            onBeforeChange={pushHistory}
          />
        </div>

        <InsightPanel
          checking={checking}
          hasChanges={hasChanges}
          onCheck={handleCheckChanges}
          summary={checkSummary}
        />
      </div>
    </div>
  );
}
