import { NextRequest, NextResponse } from "next/server";
import { createMemory, searchMemory } from "@/lib/memory-client";

export async function POST(req: NextRequest) {
  try {
    const { action, text, query } = await req.json();

    if (action === "store") {
      const result = await createMemory(text);
      return NextResponse.json({ ok: true, result });
    }

    if (action === "search") {
      const result = await searchMemory(query);
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[memory API]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
