import { NextRequest, NextResponse } from "next/server";
import { celebrityForDate } from "@/lib/daily";
import { letterPositions, normalize } from "@/lib/answer";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, letter } = body as { date?: string; letter?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (!letter || normalize(letter).length !== 1 || !/^[a-z]$/.test(normalize(letter))) {
    return NextResponse.json({ error: "invalid letter" }, { status: 400 });
  }

  const celeb = celebrityForDate(date);
  const positions = letterPositions(celeb.name, letter);

  return NextResponse.json({
    letter: letter.toUpperCase(),
    correct: positions.length > 0,
    positions,
  });
}
