export type GameResult = {
  date: string;
  won: boolean;
  livesLost: number;
  cluesUsed: number;
  firstClueText: string;
};

export type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  history: Record<string, GameResult>; // keyed by date
};

const STORAGE_KEY = "cluebrity-stats";
const SYNC_CODE_KEY = "cluebrity-sync-code";

const emptyStats: Stats = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastPlayedDate: null,
  history: {},
};

export function loadStats(): Stats {
  if (typeof window === "undefined") return emptyStats;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats;
    return { ...emptyStats, ...JSON.parse(raw) };
  } catch {
    return emptyStats;
  }
}

function isConsecutiveDay(prevDate: string, date: string): boolean {
  const prev = new Date(prevDate + "T00:00:00Z").getTime();
  const curr = new Date(date + "T00:00:00Z").getTime();
  return curr - prev === 24 * 60 * 60 * 1000;
}

// Recomputes aggregate stats from a full history so results from two devices
// can be merged by simply unioning their history maps and refolding.
function computeStats(history: Record<string, GameResult>): Stats {
  let played = 0;
  let wins = 0;
  let currentStreak = 0;
  let maxStreak = 0;
  let lastPlayedDate: string | null = null;

  for (const date of Object.keys(history).sort()) {
    const result = history[date];
    played += 1;
    if (result.won) {
      wins += 1;
      currentStreak = lastPlayedDate && isConsecutiveDay(lastPlayedDate, date) ? currentStreak + 1 : 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    lastPlayedDate = date;
  }

  return { played, wins, currentStreak, maxStreak, lastPlayedDate, history };
}

export function recordResult(result: GameResult): Stats {
  const stats = loadStats();
  if (stats.history[result.date]) {
    // Already recorded for this date; don't double-count.
    return stats;
  }

  const updated = computeStats({ ...stats.history, [result.date]: result });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function saveStats(stats: Stats): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }
}

// Unions two stats' play histories (by date) and refolds aggregates, so
// linking a second device never loses results recorded on either one.
export function mergeStats(a: Stats, b: Stats): Stats {
  return computeStats({ ...b.history, ...a.history });
}

export function getSyncCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SYNC_CODE_KEY);
}

export function setSyncCode(code: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SYNC_CODE_KEY, code);
  }
}

export function buildShareText(result: GameResult, puzzleNumber: number): string {
  const lives = 6;
  const livesRemaining = lives - result.livesLost;
  const hearts = Array.from({ length: lives }, (_, i) =>
    i < livesRemaining ? "❤️" : "🖤"
  ).join("");
  const outcome = result.won ? `${livesRemaining}/${lives}` : "X/6";
  const clueWord = result.cluesUsed === 1 ? "clue" : "clues";
  return `Cluebrity #${puzzleNumber} ${outcome}\n${hearts}\n💡 ${result.cluesUsed} ${clueWord} used\n${result.firstClueText}`;
}
