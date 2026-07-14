import { celebrities } from "./celebrities";
import type { Celebrity } from "./types";

const EPOCH = Date.UTC(2024, 0, 1); // puzzle #0
const DAY_MS = 24 * 60 * 60 * 1000;

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function puzzleNumberForDate(dateStr: string): number {
  const date = Date.UTC(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10))
  );
  const daysSinceEpoch = Math.floor((date - EPOCH) / DAY_MS);
  return ((daysSinceEpoch % celebrities.length) + celebrities.length) % celebrities.length;
}

export function celebrityForDate(dateStr: string): Celebrity {
  return celebrities[puzzleNumberForDate(dateStr)];
}
