# Planscaped.ai

> Your plans are a mess. Let's untangle them.

Paste a chaotic plan. Watch AI turn it into a crisp, editable dependency flowchart. Drag nodes around. Delete things recklessly. Then ask Claude to tell you what you broke.

Built with [Next.js](https://nextjs.org), [CopilotKit](https://copilotkit.ai), [React Flow](https://reactflow.dev), and an unreasonable amount of caffeine.

---

## What it does

1. **You paste a plan** -- bullet points, stream of consciousness, meeting notes, whatever
2. **Claude reads it** and extracts a dependency graph (who blocks whom, what goes first)
3. **You get an interactive flowchart** -- drag, connect, delete, add steps
4. **You break things** (you will)
5. **Claude reviews your changes** and tells you exactly what you messed up, with color-coded severity

It also has long-term memory (Redis), so Claude remembers your past mistakes. Because someone should.

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com)
- Redis (optional, for memory features -- see `docker-compose.yml`)

### Setup

```bash
# Install dependencies
npm install

# Copy env and add your API key
cp .env.local.example .env.local

# Start Redis (optional)
docker compose up -d

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start untangling.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| AI Orchestration | CopilotKit |
| LLM | Claude (Anthropic) |
| Graph Rendering | React Flow |
| Graph Layout | Dagre |
| Styling | Tailwind CSS v4 |
| Memory | Redis (via Docker) |

---

## Project Structure

```
spike/
├── app/
│   ├── api/
│   │   ├── copilotkit/   # CopilotKit runtime endpoint
│   │   ├── elaborate/    # Plan rephrasing endpoint
│   │   └── memory/       # Redis memory store/search
│   ├── layout.tsx        # Root layout + CopilotKit provider
│   ├── page.tsx          # Main app page (all the action)
│   └── globals.css       # Global styles + custom effects
├── components/
│   ├── graph-view.tsx    # React Flow wrapper
│   ├── custom-node.tsx   # Custom node with delete + annotations
│   ├── custom-edge.tsx   # Custom edge with delete button
│   └── insight-panel.tsx # Right sidebar with check results
└── lib/
    ├── diff.ts           # Graph snapshot diffing
    ├── graph-layout.ts   # Dagre layout helper
    └── memory-client.ts  # Redis MCP client
```

---

## License

Do whatever you want with this. If your plans are still a mess afterward, that's on you.
