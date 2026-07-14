import { NextRequest, NextResponse } from "next/server";
import { celebrityForDate } from "@/lib/daily";

const TOTAL_LIVES = 6;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, livesLost, won } = body as {
    date?: string;
    livesLost?: number;
    won?: boolean;
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const gameOver = won === true || (typeof livesLost === "number" && livesLost >= TOTAL_LIVES);
  if (!gameOver) {
    return NextResponse.json({ error: "game not over" }, { status: 403 });
  }

  const celeb = celebrityForDate(date);
  return NextResponse.json({ name: celeb.name, category: celeb.category });
}
