import { NextRequest, NextResponse } from "next/server";
import { celebrityForDate } from "@/lib/daily";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const level = Number(req.nextUrl.searchParams.get("level"));
  const wrongGuesses = Number(req.nextUrl.searchParams.get("wrongGuesses") ?? "0");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (!Number.isInteger(level) || level < 1) {
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }
  // Clue N (N>1) unlocks after N-1 wrong guesses; level 1 is always free.
  if (level > 1 && wrongGuesses < level - 1) {
    return NextResponse.json({ error: "clue not yet unlocked" }, { status: 403 });
  }

  const celeb = celebrityForDate(date);
  const clue = celeb.clues.find((c) => c.level === level) ?? null;

  return NextResponse.json({ level, clue });
}
