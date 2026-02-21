import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const MCP_URL = "http://localhost:9000/sse";

async function withMCPClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new SSEClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "planscape", version: "1.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export async function createMemory(text: string): Promise<string> {
  return withMCPClient(async (client) => {
    const result = await client.callTool({
      name: "create_long_term_memories",
      arguments: { memories: [{ text }] },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    return content?.[0]?.text ?? "ok";
  });
}

export async function searchMemory(query: string): Promise<string> {
  return withMCPClient(async (client) => {
    const result = await client.callTool({
      name: "search_long_term_memory",
      arguments: { text: query, limit: 5 },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    return content?.[0]?.text ?? "No memories found.";
  });
}
