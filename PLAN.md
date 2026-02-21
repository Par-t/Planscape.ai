# MinUI — Project Plan

## Concept

Upload a document or paste a plan. Claude reads it and externalizes it as an interactive flowchart. You edit the flowchart visually — drag, delete, reconnect nodes. Click "Check My Changes" and Claude reacts: flags broken dependencies, warns about ordering issues, surfaces suggestions. Over multiple edits, Claude remembers past analysis and notices patterns.

**The novel part:** bidirectional + memory. Claude builds the graph from your document. You reshape it. Claude responds intelligently — and gets smarter with each check because it stores analysis in Redis.

---

## Stack

- **Next.js** (App Router) — frontend + API routes
- **CopilotKit** — connects Claude to React, tool calls, MCP routing
- **React Flow** — interactive graph renderer (drag, delete, connect nodes)
- **dagre** — auto-layout algorithm (left-to-right dependency layout)
- **Anthropic SDK** (direct) — `AnthropicAdapter` in CopilotRuntime
- **Redis Agent Memory Server** (Docker) — semantic memory over MCP, exposed to Claude

---

## Architecture (Target)

```
PHASE 1: Generate
User pastes plan → CopilotKit sends to Claude → Claude calls createGraph(nodes, edges)
→ dagre lays it out → React Flow renders interactive graph

PHASE 2: Edit
User drags/deletes/connects nodes freely (no API calls during editing)
→ "Check My Changes" button appears when graph differs from confirmed state

PHASE 3: React (agentic, via CopilotKit + MCP)
Button click → diff computed (old vs new graph)
→ appendMessage through CopilotKit with: sessionId + originalPlan + changes[] + current graph
→ Claude: search_long_term_memory → reason → flagNode() + addInsight() → create_long_term_memory
→ Nodes turn red/yellow/green, insight panel shows Claude's commentary

PHASE 4: Memory (Redis Agent Memory Server)
Claude stores per-session analysis in Redis via MCP tools
On each subsequent check, Claude searches past analysis first
→ Notices patterns, escalates recurring issues, personalises responses
```

---

## What's DONE

### Phase 1 — Graph Generation ✅
- User pastes a plan → "Generate Graph" button
- CopilotKit sends to Claude via `appendMessage`
- Claude calls `createGraph(nodes, edges)` action
- dagre auto-layout applied (left-to-right)
- React Flow renders the result

### Phase 2 — Editable Graph ✅
- Nodes draggable, deletable (Backspace key)
- Edges deletable, new connections drawable (drag handle to handle)
- `confirmedGraph` ref tracks last confirmed state
- `hasChanges` state enables/disables the Check button

### Phase 3 — Check My Changes ✅ (direct API, to be replaced)
- `lib/diff.ts` — snapshot + diff two graph states → `string[]` of changes
- `/api/check-changes/route.ts` — direct Anthropic SDK call (NOT CopilotKit)
  - Input: `{ originalPlan, previousGraph, currentGraph, changes[] }`
  - Output: `{ warnings[], suggestions[], nodeStatuses{ id: "ok"|"warning"|"error" } }`
- `components/insight-panel.tsx` — right sidebar showing warnings (red) and suggestions (indigo)
- Nodes recolor: green = ok, yellow = warning, red = error
- Confirmed state updates after each check

### Files in place
```
spike/
  app/
    page.tsx                    ✅ Full state + all handlers
    layout.tsx                  ✅ CopilotKit provider
    api/
      copilotkit/route.ts       ✅ CopilotRuntime + AnthropicAdapter (claude-sonnet-4-5)
      check-changes/route.ts    ✅ Direct Claude call — WILL BE DELETED in Phase 4
  components/
    graph-view.tsx              ✅ React Flow, editable, connected
    insight-panel.tsx           ✅ Warnings + suggestions panel
  lib/
    graph-layout.ts             ✅ dagre layout
    diff.ts                     ✅ GraphSnapshot + diffGraphs
  .env.local                    ✅ ANTHROPIC_API_KEY set
```

---

## What's Being Planned (Phase 4 — Agentic Memory via MCP)

### Goal
Replace the dumb single-shot `/api/check-changes` call with a full agentic loop:
Claude gets memory tools, searches past analysis before reasoning, stores insights after, and escalates patterns it notices over time.

### Infrastructure
`spike/docker-compose.yml` — Redis + Agent Memory Server
```yaml
services:
  redis:
    image: redis/redis-stack:latest
    ports: ["6379:6379", "8001:8001"]

  memory-server:
    image: redislabs/agent-memory-server:latest
    ports: ["9000:9000"]
    environment:
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GENERATION_MODEL: claude-sonnet-4-5
      EMBEDDING_MODEL: text-embedding-3-small
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      DISABLE_AUTH: "true"
    command: ["agent-memory", "mcp", "--mode", "sse", "--port", "9000"]
    depends_on: [redis]
```
Start: `docker compose up`
MCP endpoint: `http://localhost:9000/mcp`

### Changes Required

**1. `spike/.env.local`** — Add:
```
OPENAI_API_KEY=sk-...       # for text-embedding-3-small
REDIS_URL=redis://localhost:6379
```

**2. `spike/app/api/copilotkit/route.ts`** — Connect MCP:
```typescript
const runtime = new CopilotRuntime({
  mcpServers: [{ endpoint: "http://localhost:9000/mcp" }]
});
```
Claude now gets: `create_long_term_memory`, `search_long_term_memory`, `memory_prompt` on every call.

**3. `spike/app/page.tsx`** — Four additions:
- `sessionId` state (UUID persisted in localStorage)
- `describeGraph(g: GraphSnapshot): string` helper
- `useCopilotAction("flagNode")` — Claude calls this to recolor nodes
- `useCopilotAction("addInsight")` — Claude calls this to populate insight panel
- Replace `handleCheckChanges` fetch with `appendMessage` through CopilotKit

**4. Delete `spike/app/api/check-changes/route.ts`** — no longer needed

### What Claude's Agentic Loop Looks Like
```
1. User clicks "Check My Changes"
2. appendMessage → Claude receives: sessionId + plan + changes + current graph
3. Claude calls search_long_term_memory("session <id> analysis history")
   → "Check 1: user deleted validation node, flagged as error"
4. Claude reasons: second offense — escalate
5. Claude calls flagNode("validation-1", "error", "Validation removed again — recurring pattern")
6. Claude calls addInsight("warning", "You've bypassed validation twice. High deployment risk.")
7. Claude calls create_long_term_memory("Session <id> Check 2: user deleted validation again, escalated")
```

Without memory: same generic warning every check.
With memory: Claude notices patterns, escalates, personalises.

---

## Demo Script

### Demo 1: ML Pipeline
1. Paste ML pipeline plan → graph generates with parallel paths
2. Drag "Training" before "Data Cleaning"
3. Click "Check" → Claude flags dependency violation, nodes turn red
4. Undo or reconnect → Click "Check" again → Claude references first check

### Demo 2: Delete a critical node
1. Delete "Beta Testing" node
2. Check → Claude: "Skipping beta means untested product ships"
3. Delete it again next session → Claude escalates: "Recurring pattern detected"

### Demo 3: Live audience
1. Audience gives a scenario
2. Paste, generate, make a bad edit, check — Claude catches it live

---

## Current Risks

| Risk | Status |
|---|---|
| Redis Agent Memory Server Docker image name | Verify: `redislabs/agent-memory-server:latest` |
| MCP SSE mode stability in CopilotKit | Untested — may need polling fallback |
| OpenAI key required for embeddings | User has it, needs to be added to .env.local |
| `appendMessage` deprecated | Works fine, won't break the spike |
| Claude calls flagNode/addInsight instead of responding in text | Handled by action descriptions — watch first test |
