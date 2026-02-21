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

## Architecture

```
PHASE 1: Generate          ✅ DONE
PHASE 2: Edit              ✅ DONE
PHASE 3: Check Changes     ✅ DONE (direct API — will be replaced in Phase 4)
PHASE 4: Agentic Memory    🔧 IN PROGRESS
PHASE 5: Polish            ⬜ TODO
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
      copilotkit/route.ts       ✅ CopilotRuntime + AnthropicAdapter + MCP config (partial)
      check-changes/route.ts    ✅ Direct Claude call — WILL BE DELETED in Phase 4
  components/
    graph-view.tsx              ✅ React Flow, editable, connected
    insight-panel.tsx           ✅ Warnings + suggestions panel
  lib/
    graph-layout.ts             ✅ dagre layout
    diff.ts                     ✅ GraphSnapshot + diffGraphs
  docker-compose.yml            ✅ Redis + Agent Memory Server
  .env.local                    ✅ ANTHROPIC_API_KEY set, OPENAI_API_KEY placeholder added
```

---

## Phase 4 — Agentic Memory via MCP 🔧

### Goal
Replace the single-shot `/api/check-changes` call with a full agentic loop:
Claude gets memory tools via MCP, searches past analysis before reasoning, stores insights after, and escalates patterns over time.

### Infrastructure (DONE)
`spike/docker-compose.yml` — Redis + Agent Memory Server
```
docker compose up → redis on :6379, memory MCP on :9000
```

### What's done so far
- `docker-compose.yml` created ✅
- `.env.local` updated with `OPENAI_API_KEY` + `REDIS_URL` placeholders ✅
- `route.ts` MCP config started (needs `ai` package import fix) ✅

### Remaining work
1. Fix `experimental_createMCPClient` import (or use correct export name from `ai` package)
2. Add `useCopilotAction("flagNode")` — Claude calls this to recolor nodes
3. Add `useCopilotAction("addInsight")` — Claude calls this to populate insight panel
4. Add `sessionId` state (UUID persisted in localStorage)
5. Add `describeGraph(g: GraphSnapshot): string` helper
6. Replace `handleCheckChanges` fetch → `appendMessage` through CopilotKit
7. Delete `/api/check-changes/route.ts`

### Claude's agentic loop (target behavior)
```
1. User clicks "Check My Changes"
2. appendMessage → Claude receives: sessionId + plan + changes + current graph
3. Claude calls search_long_term_memory("session <id> analysis")
   → "Check 1: user deleted validation node, flagged as error"
4. Claude reasons: second offense — escalate
5. Claude calls flagNode("validation-1", "error", "Validation removed again")
6. Claude calls addInsight("warning", "You've bypassed validation twice")
7. Claude calls create_long_term_memory("Session <id> Check 2: escalated")
```

---

## Phase 5 — Polish ⬜

### 5A. Visual Design

**Node styling**
- Custom React Flow nodes with rounded cards, subtle shadows, and icon badges
- Status glow effects: soft green pulse for ok, amber shimmer for warning, red throb for error
- Smooth CSS transitions when status changes (not instant recolor)
- Node labels with truncation + tooltip on hover for long labels

**Dynamic gradient background**
- Animated mesh gradient on the page background (dark theme: deep indigo → violet → slate)
- Subtle movement — slow, drifting gradient that feels alive but isn't distracting
- Could use CSS `@property` animated gradients or a small canvas shader

**Edge styling**
- Gradient edges (source color → target color) instead of flat indigo
- Thicker edges for critical-path dependencies
- Dashed edges for "suggested" connections Claude recommends

**Color palette upgrade**
- Move from flat Tailwind colors to a richer, more cohesive palette
- Status colors with proper opacity layers: `bg-red-500/10 border-red-500/40` instead of hard borders
- Glassmorphism on panels: `backdrop-blur-xl bg-zinc-900/60`

### 5B. Interaction Polish

**Graph animations**
- Nodes animate into position on first generation (staggered fade + slide from center)
- When Claude flags a node, it briefly shakes or pulses before settling into its new color
- Edge draw animation: edges appear as if being drawn, not popping in

**Transitions**
- Smooth panel transitions (insight panel slides in, warnings fade in with stagger)
- Loading state: skeleton shimmer → content with crossfade
- Button state transitions: idle → loading spinner → success checkmark

**Better empty states**
- Illustrated empty state for the graph area (faint wireframe graph placeholder)
- Welcome message with suggested demo plans to try

### 5C. Layout & UX

**Responsive layout**
- Collapsible left panel (plan input)
- Collapsible right panel (insights)
- Full-width graph view when panels are collapsed
- Keyboard shortcut to toggle panels

**Header bar**
- Project title + session indicator
- "New Session" button to reset
- Connection status indicator (Redis/MCP connected or not)

**Insight panel upgrade**
- Timestamp on each warning/suggestion
- Severity icons (⚠️ 🔴 ✅) next to each item
- Collapsible history: see past checks, not just the latest
- "Accept" button on suggestions to auto-apply them

### 5D. Micro-interactions

- Cursor changes on draggable nodes
- Hover effects on nodes: slight lift + shadow increase
- Click feedback on buttons: brief scale down + up
- Toast notifications for actions ("Graph generated", "Changes checked")

---

## Demo Script

### Demo 1: ML Pipeline
1. Paste ML pipeline plan → graph generates with animated node entrance
2. Drag "Training" before "Data Cleaning"
3. Click "Check" → Claude flags dependency violation, node pulses red
4. Click "Check" again → Claude references first check, escalates

### Demo 2: Delete a critical node
1. Delete "Beta Testing" node
2. Check → Claude: "Skipping beta means untested product ships"
3. Delete it again → Claude notices pattern from memory, escalates severity

### Demo 3: Live audience
1. Audience gives a scenario
2. Paste, generate (animated), make a bad edit, check — Claude catches it live
3. Show the memory: "Claude remembered your last mistake"

---

## Current Risks

| Risk | Status |
|---|---|
| `experimental_createMCPClient` export not found in `ai` v6 | Need to check correct import path |
| Redis Agent Memory Server Docker image name | Verify: `redislabs/agent-memory-server:latest` |
| MCP SSE mode stability in CopilotKit | Untested — may need polling fallback |
| OpenAI key required for embeddings | User has it, needs actual key in .env.local |
| `appendMessage` deprecated | Works fine, won't break the spike |
| Claude calls flagNode/addInsight instead of responding in text | Handled by action descriptions — watch first test |
| Polish scope creep | Phase 5 is a buffet — pick 3-4 items max, not all |
