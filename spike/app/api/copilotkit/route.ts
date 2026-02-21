import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { experimental_createMCPClient } from "@ai-sdk/mcp";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const runtime = new CopilotRuntime({
  mcpServers: [{ endpoint: "http://localhost:9000/sse" }],
  async createMCPClient(config) {
    return await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: config.endpoint,
      },
    });
  },
});

const serviceAdapter = new AnthropicAdapter({ anthropic: client, model: "claude-sonnet-4-6" });

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
