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

function friendlyError(raw?: string): string {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("credit") || msg.includes("billing") || msg.includes("402") || msg.includes("payment") || msg.includes("insufficient")) {
    return "Your Anthropic API credits have run out. Add credits at console.anthropic.com to continue.";
  }
  if (msg.includes("rate") || msg.includes("429") || msg.includes("too many")) {
    return "Too many requests — please wait a moment and try again.";
  }
  if (msg.includes("auth") || msg.includes("401") || msg.includes("invalid") && msg.includes("key")) {
    return "Your API key appears to be invalid. Check ANTHROPIC_API_KEY in .env.local.";
  }
  if (msg.includes("overloaded") || msg.includes("529")) {
    return "Claude is currently overloaded. Try again in a few seconds.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnrefused")) {
    return "Could not reach the server. Check your internet connection and make sure the dev server is running.";
  }
  return "Something went wrong. Check that your API key is valid and you have credits at console.anthropic.com.";
}

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
  const [error, setError] = useState<string | null>(null);

  // Track whether CopilotKit operations actually produced results
  const generateSucceededRef = useRef(false);
  const checkSucceededRef = useRef(false);

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

  const { appendMessage, isLoading: isCopilotLoading } = useCopilotChat();

  // Track CopilotKit loading transitions to detect when Claude finishes
  const prevCopilotLoadingRef = useRef(false);

  useEffect(() => {
    // When CopilotKit transitions from loading → not loading while an
    // operation is in progress, Claude has finished (or failed silently).
    if (checking && prevCopilotLoadingRef.current && !isCopilotLoading) {
      setChecking(false);
      if (!checkSucceededRef.current) {
        setError(friendlyError());
      }
    }
    if (loading && prevCopilotLoadingRef.current && !isCopilotLoading) {
      setLoading(false);
      if (!generateSucceededRef.current) {
        setError(friendlyError());
      }
    }
    prevCopilotLoadingRef.current = isCopilotLoading;
  }, [isCopilotLoading, checking, loading]);

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
      setWarnings([]);
      setSuggestions([]);
      setHasChanges(false);
      confirmedGraph.current = snapshotFromFlow(laid, flowEdges);
      generateSucceededRef.current = true;
    },
  });

  useCopilotAction({
    name: "flagNode",
    description:
      "Mark a project step with a status. Call once per step. " +
      "'ok' = this step is fine, 'warning' = potential project risk, " +
      "'error' = this step will fail or is missing something critical. " +
      "The reason MUST be about the project content — e.g. 'Model training needs clean data but the preprocessing step was removed'. " +
      "NEVER mention edges, arrows, nodes, graphs, incoming/outgoing connections, or visual structure.",
    parameters: [
      { name: "nodeId", type: "string", description: "The ID of the step to mark", required: true },
      { name: "status", type: "string", description: "ok | warning | error", required: true },
      { name: "reason", type: "string", description: "Plain-language project reason — what will go wrong or why this step is fine. Never mention edges, arrows, or graph structure.", required: true },
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
      "Add a project-level warning or suggestion. " +
      "Use 'warning' for real project risks (e.g. 'Skipping testing means bugs will reach production'). " +
      "Use 'suggestion' for improvements. Write in plain project language — never mention edges, arrows, nodes, or graph terms.",
    parameters: [
      { name: "type", type: "string", description: "warning | suggestion", required: true },
      { name: "message", type: "string", description: "A project risk or suggestion in plain language. Never reference graph structure.", required: true },
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
      "Provide a brief overall summary of the plan review. " +
      "Summarize what changed in the project plan, whether the plan will still succeed, and any key risks. " +
      "Write in plain language as if briefing a project manager. Never mention edges, arrows, nodes, or graph terms. " +
      "Keep it to 2-3 short sentences. Call this FIRST before other tools.",
    parameters: [
      { name: "summary", type: "string", description: "A 2-3 sentence project health summary in plain language. No graph/visual terms.", required: true },
    ],
    handler: ({ summary }: { summary: string }) => {
      console.log(`[summarizeCheck] ${summary}`);
      setCheckSummary(summary);
      checkSucceededRef.current = true;
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
    setError(null);
    try {
      const res = await fetch("/api/elaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planText }),
      });
      const data = await res.json();
      if (data.ok && data.plan) {
        setPlanText(data.plan);
      } else {
        setError(friendlyError(data.error));
      }
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setExpanding(false);
    }
  };

  const handleGenerate = async () => {
    if (!planText.trim()) return;
    setLoading(true);
    setError(null);
    generateSucceededRef.current = false;
    setNodes([]);
    setEdges([]);
    confirmedGraph.current = null;
    try {
      await appendMessage(
        new TextMessage({
          role: MessageRole.User,
          content: `Here is the plan to analyze:\n\n${planText}`,
        })
      );
    } catch (e) {
      setLoading(false);
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    }
  };

  const handleCheckChanges = async () => {
    if (!confirmedGraph.current) return;
    const current = snapshotFromFlow(nodes, edges);
    const changes = diffGraphs(confirmedGraph.current, current);
    if (changes.length === 0) return;

    setChecking(true);
    setError(null);
    checkSucceededRef.current = false;
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
          content: `Review these project plan changes. Respond ONLY with tool calls, no text.

PLAN: ${planTextRef.current}

BEFORE: ${describeGraph(confirmedGraph.current)}

AFTER: ${describeGraph(current)}

CHANGES: ${changes.join("; ")}

Do these in order:
1. summarizeCheck — 2 sentences: what changed + will the plan still work?
2. flagNode for each step — status (ok/warning/error) + 1-sentence reason about the PROJECT (e.g. "Training will fail without clean data"). NEVER mention arrows, edges, nodes, graphs, or visual structure.
3. addInsight — max 1 warning and 1 suggestion as project risks.
4. storeMemory — "Session ${sessionId} Check ${checkNum}: [your summary]"`,
        })
      );

      confirmedGraph.current = current;
      setHasChanges(false);
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
      setChecking(false);
    }
    // NOTE: setChecking(false) is NOT called here on success.
    // The useEffect watching isCopilotLoading handles it — it waits
    // for Claude to finish all tool calls (flagNode, summarizeCheck, etc.)
    // before turning off the checking state.
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
          {error && (
            <div className="absolute top-4 left-4 right-4 z-30 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 backdrop-blur-sm animate-in fade-in">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="flex-1 text-sm text-red-200 leading-relaxed">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-200 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
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
          error={error}
        />
      </div>
    </div>
  );
}
