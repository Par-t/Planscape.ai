import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { GraphSnapshot } from "@/lib/diff";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CheckChangesRequest {
  originalPlan: string;
  previousGraph: GraphSnapshot;
  currentGraph: GraphSnapshot;
  changes: string[];
}

interface CheckChangesResponse {
  warnings: string[];
  suggestions: string[];
  nodeStatuses: Record<string, "ok" | "warning" | "error">;
}

export async function POST(req: NextRequest) {
  const body: CheckChangesRequest = await req.json();
  const { originalPlan, previousGraph, currentGraph, changes } = body;

  if (changes.length === 0) {
    return NextResponse.json({
      warnings: [],
      suggestions: ["No changes detected."],
      nodeStatuses: {},
    });
  }

  const prompt = `You are a plan dependency analyzer. A user has a plan document and an interactive dependency graph representing it. They have just made edits to the graph.

ORIGINAL PLAN:
${originalPlan}

PREVIOUS GRAPH:
Nodes: ${previousGraph.nodes.map((n) => `"${n.label}" (id: ${n.id})`).join(", ")}
Edges: ${previousGraph.edges.map((e) => {
    const src = previousGraph.nodes.find((n) => n.id === e.source)?.label ?? e.source;
    const tgt = previousGraph.nodes.find((n) => n.id === e.target)?.label ?? e.target;
    return `"${src}" → "${tgt}"`;
  }).join(", ")}

CURRENT GRAPH (after user edits):
Nodes: ${currentGraph.nodes.map((n) => `"${n.label}" (id: ${n.id})`).join(", ")}
Edges: ${currentGraph.edges.map((e) => {
    const src = currentGraph.nodes.find((n) => n.id === e.source)?.label ?? e.source;
    const tgt = currentGraph.nodes.find((n) => n.id === e.target)?.label ?? e.target;
    return `"${src}" → "${tgt}"`;
  }).join(", ")}

CHANGES MADE:
${changes.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Analyze whether these changes break any dependencies or create logical problems based on the original plan. Consider:
- Are there steps that now run before their prerequisites?
- Are critical steps missing?
- Are new dependencies logical?

Respond with ONLY valid JSON in this exact shape:
{
  "warnings": ["string — a concrete problem caused by a specific change"],
  "suggestions": ["string — a helpful suggestion or observation"],
  "nodeStatuses": {
    "<node-id>": "ok" | "warning" | "error"
  }
}

Be concise. Max 2 warnings, max 2 suggestions. Only flag real problems, not stylistic ones. If the changes are fine, return empty warnings array and a positive suggestion.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response (Claude sometimes wraps in markdown)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({
      warnings: ["Could not parse Claude response."],
      suggestions: [],
      nodeStatuses: {},
    });
  }

  const result: CheckChangesResponse = JSON.parse(jsonMatch[0]);
  return NextResponse.json(result);
}
