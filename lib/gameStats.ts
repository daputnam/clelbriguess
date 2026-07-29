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

export function recordResult(result: GameResult): Stats {
  const stats = loadStats();
  if (stats.history[result.date]) {
    // Already recorded for this date; don't double-count.
    return stats;
  }

  stats.history[result.date] = result;
  stats.played += 1;
  if (result.won) {
    stats.wins += 1;
    stats.currentStreak =
      stats.lastPlayedDate && isConsecutiveDay(stats.lastPlayedDate, result.date)
        ? stats.currentStreak + 1
        : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }
  stats.lastPlayedDate = result.date;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }
  return stats;
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
