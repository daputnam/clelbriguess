import { NextRequest, NextResponse } from "next/server";
import { celebrityForDate } from "@/lib/daily";
import { namesMatch } from "@/lib/answer";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, guess } = body as { date?: string; guess?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (!guess || typeof guess !== "string") {
    return NextResponse.json({ error: "invalid guess" }, { status: 400 });
  }

  const celeb = celebrityForDate(date);
  const correct = namesMatch(guess, celeb.name, celeb.aliases);

  return NextResponse.json({
    correct,
    // Only reveal the name once the player has actually gotten it right.
    name: correct ? celeb.name : undefined,
  });
}
