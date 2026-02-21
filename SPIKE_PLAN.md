# Spike: CopilotKit + Claude → Graph

## Goal
Test if CopilotKit can take a pasted plan, send it to Claude, and render a meaningful dependency graph.

## Scope
This is a test only. No Redis, no live reactions, no polish.

---

## Steps

### 1. Scaffold Next.js app
- `npx create-next-app@latest` with TypeScript + Tailwind
- Install CopilotKit: `@copilotkit/react-core @copilotkit/react-ui`
- Install React Flow: `reactflow`

### 2. CopilotKit setup
- Wrap app in `<CopilotKit>` pointing to a local runtime
- Create API route: `/api/copilotkit/route.ts` using CopilotKitRuntime + AnthropicAdapter

### 3. Define the action
- `useCopilotAction("createGraph")` — Claude calls this with nodes + edges
- Store result in React state

### 4. User input
- Simple textarea: user pastes a plan
- Button: "Generate Graph"
- Sends text as a copilot message

### 5. Render the graph
- React Flow reads nodes + edges from state
- Auto-layout with dagre

---

## Claude System Prompt
```
Extract the top-level steps from the user's plan and their dependencies.

Rules:
- Max 8 nodes
- Each node label: 3-5 words
- Identify which steps must come before others (edges)
- Identify parallel steps (no edge between them, both depend on same parent)

Call createGraph with the result.
```

---

## Test Input
```
We need to collect training data, then clean and preprocess it.
While that's happening, we can set up the ML infrastructure.
Once data is ready and infra is up, we train the model.
After training, we validate results, and if good, deploy to production.
Monitoring should be set up before deployment.
```

## Expected Output
- Data Collection → Cleaning → Training → Validation → Deployment
- ML Infra Setup → Training
- Monitoring Setup → Deployment
- Parallel paths visible

---

## Success Criteria
1. CopilotKit connects to Claude (Anthropic) — no auth errors
2. Claude calls `createGraph` with valid nodes + edges
3. Parallel dependencies are captured (not just a linear list)
4. Graph renders on screen

---

## File Structure
```
/app
  /page.tsx                   — textarea + graph + generate button
  /api/copilotkit/route.ts    — CopilotKit runtime with AnthropicAdapter
/components
  /graph-view.tsx             — React Flow renderer
/lib
  /graph-layout.ts            — dagre auto-layout helper
```

## Time Budget
- Setup + install: 20 min
- CopilotKit + Claude wiring: 30 min
- React Flow rendering: 30 min
- Testing + iteration on prompt: 30 min
- Total: ~2 hours
