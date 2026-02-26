# Planscape.ai

> Turn messy project plans into interactive, AI-validated flowcharts — in seconds.

Planscape.ai is an AI-powered planning tool where you describe your project in plain English, and an AI agent (Claude) converts it into a visual dependency graph. You can then drag, edit, and rewire the graph — and when you're done, ask Claude to validate your changes. It remembers past checks, detects recurring issues, and flags broken dependencies with color-coded annotations.

---

## Features

- **Natural Language to Flowchart** — Paste a plan in plain text, Claude extracts steps and dependencies, and renders an interactive graph automatically
- **Full Graph Editing** — Drag nodes, delete steps (Backspace), create new connections, add new nodes, and rewire dependencies freely
- **AI-Powered Validation** — Click "Check My Changes" and Claude diffs your edits against the original, flagging broken dependencies as ok (green), warning (yellow), or error (red)
- **Persistent Memory** — Claude stores each analysis in Redis via MCP. On subsequent checks, it recalls past patterns and escalates repeated issues
- **Undo History** — Ctrl+Z to undo, with a 30-state history stack
- **Plan Rephrasing** — Optional "Rephrase it" button lets Claude clean up ambiguous language before generating
- **Insight Panel** — A sidebar displays a summary, warnings, and suggestions after each validation

---

## How It Works

The app follows a **Generate → Edit → Validate** loop:

```
  1. GENERATE                    2. EDIT                      3. VALIDATE
  ┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
  │ Paste your plan  │     │ Drag, delete, rewire │     │ Claude diffs changes │
  │       ↓          │     │ Add new nodes/edges  │     │ Flags broken deps    │
  │ Claude extracts  │ ──→ │ Ctrl+Z to undo       │ ──→ │ Colors: ok/warn/err  │
  │ steps + deps     │     │                      │     │ Stores in Redis      │
  │       ↓          │     │                      │     │ Recalls past checks  │
  │ Renders graph    │     │                      │     │                      │
  └─────────────────┘     └─────────────────────┘     └──────────────────────┘
                                                               │
                                                               ↓
                                                        Edit more → Re-validate
```

Under the hood:
1. Your plan text is sent to **Claude** via **CopilotKit**
2. Claude calls a `createGraph` tool action to output nodes and edges
3. The graph is auto-laid out using **dagre** and rendered with **React Flow**
4. When you click "Check My Changes", the app computes a diff (added/deleted nodes and edges) and sends it to Claude
5. Claude calls `searchMemory` to check past analyses, then `flagNode` / `addInsight` / `storeMemory` to annotate and remember

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | [Next.js 16](https://nextjs.org/) (App Router), React 19, [Tailwind CSS 4](https://tailwindcss.com/) |
| Graph Visualization | [React Flow 11](https://reactflow.dev/) + [dagre](https://github.com/dagrejs/dagre) (auto-layout) |
| AI Orchestration | [CopilotKit 1.51](https://www.copilotkit.ai/) |
| AI Model | Claude Sonnet 4.6 (via [Anthropic SDK](https://docs.anthropic.com/)) |
| Memory | Redis + [Agent Memory Server](https://github.com/modelcontextprotocol/servers) (MCP over SSE) |
| Infrastructure | Docker Compose |

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js** (v18 or higher)
- **Docker** and **Docker Compose**
- An **Anthropic API key** ([get one here](https://console.anthropic.com/))
- An **OpenAI API key** (used for embeddings in the Redis Memory Server — [get one here](https://platform.openai.com/api-keys))

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/planscape-ai.git
cd planscape-ai
```

### 2. Install dependencies

```bash
cd spike
npm install
```

### 3. Set up environment variables

Create a `.env.local` file inside the `spike/` directory:

```env
ANTHROPIC_API_KEY=sk-ant-...       # Your Anthropic API key
OPENAI_API_KEY=sk-proj-...         # Your OpenAI API key (for memory embeddings)
```

### 4. Start Redis and the Memory Server

```bash
docker compose up
```

This starts:
- **Redis** on `localhost:6379` (with Redis Stack UI on `localhost:8001`)
- **Agent Memory Server** on `localhost:9000` (MCP SSE endpoint for persistent memory)

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. **Write your plan** — Type or paste a project plan into the text area (a sample ML pipeline plan is pre-filled)
2. **Rephrase (optional)** — Click "Rephrase it" to let Claude clean up ambiguous wording
3. **Generate** — Click "Generate Graph" and watch Claude build an interactive dependency flowchart
4. **Edit** — Drag nodes to rearrange, press Backspace to delete selected nodes/edges, click between nodes to connect them, or add new nodes
5. **Validate** — Click "Check My Changes" in the right panel. Claude compares your edits to the original, flags issues with color-coded borders, and shows a summary with warnings and suggestions
6. **Iterate** — Keep editing and re-validating. Claude remembers past checks and will escalate recurring patterns

---

## Project Structure

```
spike/
├── app/
│   ├── page.tsx                 # Main page — all state, 6 CopilotActions, UI
│   ├── layout.tsx               # CopilotKit provider wrapper
│   └── api/
│       ├── copilotkit/route.ts  # CopilotKit runtime + Anthropic adapter
│       ├── memory/route.ts      # Memory store/search via MCP → Redis
│       └── elaborate/route.ts   # Plan rephrasing (direct Claude call)
├── components/
│   ├── graph-view.tsx           # React Flow wrapper + empty state
│   ├── custom-node.tsx          # Styled node with annotation badges
│   ├── custom-edge.tsx          # Smooth-step edge with delete button
│   └── insight-panel.tsx        # Right sidebar: summary, warnings, suggestions
├── lib/
│   ├── diff.ts                  # Graph snapshot diffing (node/edge adds & deletes)
│   ├── graph-layout.ts          # dagre auto-layout algorithm
│   └── memory-client.ts         # MCP client (SSE) → Redis Agent Memory Server
├── docker-compose.yml           # Redis + Memory Server containers
└── .env.local                   # API keys (not committed)
```

---

## CopilotKit Actions

Claude interacts with the app through six tool actions defined via CopilotKit:

| Action | What it does |
|--------|-------------|
| `createGraph` | Extracts steps and dependencies from the plan, builds the initial graph (max 8 nodes) |
| `flagNode` | Marks a node as `ok`, `warning`, or `error` with a reason (updates border color) |
| `addInsight` | Pushes a warning or suggestion message to the insight panel |
| `summarizeCheck` | Sets a 2-3 sentence summary of the validation results |
| `storeMemory` | Persists the current analysis to Redis for future reference |
| `searchMemory` | Retrieves past analyses to detect recurring patterns before validating |

---

## Key Design Decisions

- **Text-based diffing over visual diffing** — The graph is serialized into a minimal snapshot (labels + connections). `diffGraphs()` produces human-readable change descriptions so Claude can reason about structural changes without needing visual input.

- **Confirmed graph baseline** — After each validation, the current graph state becomes the new baseline. Only edits made after the last check trigger the next diff, preventing redundant re-analysis.

- **MCP for memory** — Memory is decoupled from CopilotKit. A separate Agent Memory Server handles vector embeddings and semantic search over Redis, connected via MCP's SSE transport.

- **Session persistence via UUID** — A UUID stored in localStorage ties all checks in a session together, allowing Claude to correlate findings across multiple validations (e.g., "user has deleted the validation step in 3 out of 5 checks").
