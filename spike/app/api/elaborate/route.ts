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
          content: `Rephrase the following text so that it is easier to convert into a flowchart. Do NOT add, remove, or change any content or steps — only rephrase the wording so that each step is a clear, concise action and dependencies between steps are obvious. Return ONLY the rephrased plan as plain text.\n\nText:\n${plan}`,
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
