# MinUI

> **Your project plan is stuck in bullet points and spreadsheet cells. That's embarrassing.**
>
> Talk to an AI agent. Watch your words become a living flowchart. Drag things around. Break dependencies. Get roasted for it. Welcome to planning that actually *flows*.

Natural language → interactive flowchart → AI-validated edits with persistent memory across sessions.

---

## How It Works

```
Plan Text → CopilotKit → Claude → createGraph action → React Flow render
                                                              ↓
                                                     User edits graph
                                                              ↓
                                              diffGraphs(confirmed, current)
                                                              ↓
                                         Claude ← searchMemory (Redis/MCP)
                                                              ↓
                                        flagNode + addInsight + storeMemory
                                                              ↓
                                            Annotated graph + Insight Panel
```

**Three phases per session:**

1. **Generate** — Claude extracts steps from your plan, identifies dependencies, outputs a dagre-laid-out graph
2. **Edit** — Drag nodes, delete steps, rewire edges, add new nodes. Ctrl+Z to undo (30-state history)
3. **Validate** — Claude diffs your edits against the original, flags broken dependencies (ok/warning/error), stores analysis in Redis for pattern detection across checks

---

## Architecture

```
spike/
├── app/
│   ├── page.tsx                 # State, 6 CopilotActions, UI orchestration
│   ├── layout.tsx               # CopilotKit provider wrapper
│   └── api/
│       ├── copilotkit/route.ts  # CopilotRuntime + AnthropicAdapter
│       ├── memory/route.ts      # Store/search → MCP → Redis
│       └── elaborate/route.ts   # Plan rephrasing (direct Anthropic call)
├── components/
│   ├── graph-view.tsx           # React Flow wrapper, node/edge change handlers
│   ├── custom-node.tsx          # Styled node + annotation badges + delete
│   ├── custom-edge.tsx          # Smooth-step edge + midpoint delete button
│   └── insight-panel.tsx        # Warnings, suggestions, summary sidebar
├── lib/
│   ├── diff.ts                  # snapshotFromFlow, diffGraphs, describeGraph
│   ├── graph-layout.ts          # dagre auto-layout (left-to-right)
│   └── memory-client.ts         # MCP client (SSE transport) → Redis Agent Memory Server
└── docker-compose.yml           # Redis + Memory Server
```

---

## CopilotActions

Six tools Claude calls via CopilotKit:

| Action | Purpose |
|--------|---------|
| `createGraph(nodes[], edges[])` | Build initial graph from plan (max 8 nodes, 3-5 word labels) |
| `flagNode(nodeId, status, reason)` | Mark node as `ok` / `warning` / `error` with reason |
| `addInsight(type, message)` | Push warning or suggestion to insight panel |
| `summarizeCheck(summary)` | Set 2-3 sentence check overview |
| `storeMemory(text)` | Persist analysis to Redis via MCP for future checks |
| `searchMemory(query)` | Retrieve past analyses to detect recurring patterns |

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Graph | React Flow 11 + dagre |
| AI Orchestration | CopilotKit 1.51 |
| Model | Claude (claude-sonnet-4-6 via Anthropic SDK) |
| Memory | Redis + Agent Memory Server (MCP over SSE) |
| Infra | Docker Compose |

---

## Setup

```bash
cd spike
npm install
```

Create `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...     # for Redis embedding model
```

Start infrastructure:

```bash
docker compose up
```

Start dev server:

```bash
npm run dev
# → http://localhost:3000
```

---

## Usage

1. Paste or edit the plan text
2. **"Rephrase it"** — optional, Claude clarifies ambiguous language
3. **"Generate Graph"** — Claude builds the dependency graph
4. Edit: drag, delete (Backspace), connect edges, add nodes
5. **"Check My Changes"** — Claude analyzes diffs, flags nodes, remembers patterns

---

## Key Design Decisions

- **Graph snapshots + diffing** — `GraphSnapshot` captures minimal state (labels + connections). `diffGraphs()` produces human-readable change descriptions Claude can reason about without visual input
- **Session persistence** — UUID in localStorage ties checks together. Claude correlates check #1 findings with check #5 patterns
- **MCP for memory** — Decoupled from CopilotKit runtime. Redis Agent Memory Server handles embedding + retrieval. Claude calls `searchMemory` before analysis, `storeMemory` after
- **Confirmed graph baseline** — After each validation, current state becomes the new baseline. Only subsequent edits trigger the next diff
