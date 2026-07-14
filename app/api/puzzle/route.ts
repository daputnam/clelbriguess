import { NextRequest, NextResponse } from "next/server";
import { celebrityForDate, puzzleNumberForDate, todayUTC } from "@/lib/daily";
import { wordLengths } from "@/lib/answer";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayUTC();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  const celeb = celebrityForDate(date);
  const firstClue = celeb.clues.find((c) => c.level === 1) ?? null;

  return NextResponse.json({
    puzzleId: date,
    puzzleNumber: puzzleNumberForDate(date),
    date,
    words: wordLengths(celeb.name),
    totalClueLevels: celeb.clues.length,
    totalLives: 6,
    firstClue,
  });
}
