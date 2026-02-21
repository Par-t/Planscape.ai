import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a project planning assistant. Take this rough plan and make it more elaborate and detailed — expand each step with a brief description of what it involves, add any missing intermediate steps, and clarify dependencies. Keep it concise (no more than 10-12 steps). Return ONLY the elaborated plan as plain text, no markdown headers or bullet formatting — just numbered steps.\n\nPlan:\n${plan}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ ok: true, plan: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[elaborate API]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
