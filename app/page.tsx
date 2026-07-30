"use client";

import { useEffect, useMemo, useState } from "react";
import type { Clue } from "@/lib/types";
import {
  buildShareText,
  recordResult,
  type Stats,
  loadStats,
  saveStats,
  mergeStats,
  getSyncCode,
  setSyncCode,
} from "@/lib/gameStats";
import { normalizeSyncCode } from "@/lib/syncWords";
import { XIcon, WhatsAppIcon, FacebookIcon, CopyIcon, ShareGenericIcon } from "@/components/ShareIcons";
import ThemeToggle from "@/components/ThemeToggle";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const TOTAL_LIVES = 6;

type Puzzle = {
  puzzleId: string;
  puzzleNumber: number;
  date: string;
  words: number[];
  totalClueLevels: number;
  totalLives: number;
  firstClue: Clue | null;
};

type LetterState = "correct" | "wrong" | "unused";

export default function Home() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [letterStates, setLetterStates] = useState<Record<string, LetterState>>({});
  const [revealedPositions, setRevealedPositions] = useState<Record<number, string>>({});
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [clues, setClues] = useState<Clue[]>([]);
  const [status, setStatus] = useState<"loading" | "playing" | "won" | "lost">("loading");
  const [revealedName, setRevealedName] = useState<string | null>(null);
  const [nameGuess, setNameGuess] = useState("");
  const [pendingLetter, setPendingLetter] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [stats, setStats] = useState<Stats | null>(() => loadStats());
  const [syncCode, setSyncCodeState] = useState<string | null>(() => getSyncCode());
  const [syncCodeInput, setSyncCodeInput] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    // If this device already has a sync code, pull down whatever's on the
    // server and merge it with what's stored locally so neither side loses history.
    const code = getSyncCode();
    if (!code) return;
    fetch(`/api/sync?code=${encodeURIComponent(code)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stats: Stats } | null) => {
        if (!data) return;
        const merged = mergeStats(loadStats(), data.stats);
        saveStats(merged);
        setStats(merged);
      })
      .catch(() => {
        // Offline or sync temporarily unavailable; keep using local stats.
      });
  }, []);

  async function createSyncCode() {
    if (!stats) return;
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats }),
      });
      if (!res.ok) throw new Error();
      const data: { code: string } = await res.json();
      setSyncCode(data.code);
      setSyncCodeState(data.code);
      setSyncMessage(`Your sync code is ${data.code} — save it to sync on another device.`);
    } catch {
      setSyncMessage("Couldn't create a sync code right now. Try again later.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function linkSyncCode(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeSyncCode(syncCodeInput);
    if (!code) {
      setSyncMessage("That doesn't look like a valid sync code.");
      return;
    }
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`);
      if (res.status === 404) {
        setSyncMessage("No progress found for that code.");
        return;
      }
      if (!res.ok) throw new Error();
      const data: { stats: Stats } = await res.json();
      const merged = mergeStats(loadStats(), data.stats);
      saveStats(merged);
      setStats(merged);
      setSyncCode(code);
      setSyncCodeState(code);
      setSyncCodeInput("");
      setSyncMessage("Synced! Your progress is now linked across devices.");
    } catch {
      setSyncMessage("Couldn't reach sync right now. Try again later.");
    } finally {
      setSyncBusy(false);
    }
  }

  useEffect(() => {
    // Use the player's local calendar date, not the server's UTC date, so the
    // puzzle rolls over at the player's own midnight (matches Wordle's behavior).
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    fetch(`/api/puzzle?date=${localDate}`)
      .then((res) => res.json())
      .then((data: Puzzle) => {
        setPuzzle(data);
        setClues(data.firstClue ? [data.firstClue] : []);
        setStatus("playing");
      });
  }, []);

  const totalLetters = useMemo(
    () => (puzzle ? puzzle.words.reduce((a, b) => a + b, 0) : 0),
    [puzzle]
  );

  async function finishGame(won: boolean, finalWrongGuesses: number, nameAlreadyKnown?: string) {
    if (!puzzle) return;
    setStatus(won ? "won" : "lost");

    if (nameAlreadyKnown) {
      setRevealedName(nameAlreadyKnown);
    } else {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: puzzle.date, livesLost: finalWrongGuesses, won }),
      });
      const data = await res.json();
      setRevealedName(data.name);
    }

    const updatedStats = recordResult({
      date: puzzle.date,
      won,
      livesLost: finalWrongGuesses,
      cluesUsed: clues.length,
      firstClueText: clues[0]?.text ?? "",
    });
    setStats(updatedStats);

    const code = getSyncCode();
    if (code) {
      fetch("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stats: updatedStats }),
      }).catch(() => {
        // Offline or sync temporarily unavailable; local stats already saved.
      });
    }
  }

  async function unlockNextClue(newWrongGuesses: number) {
    if (!puzzle) return;
    const nextLevel = newWrongGuesses + 1;
    if (nextLevel > puzzle.totalClueLevels) return;
    const res = await fetch(
      `/api/clue?date=${puzzle.date}&level=${nextLevel}&wrongGuesses=${newWrongGuesses}`
    );
    const data = await res.json();
    if (data.clue) {
      setClues((prev) => [...prev, data.clue]);
    }
  }

  async function guessLetter(letter: string) {
    if (!puzzle || status !== "playing" || letterStates[letter]) return;
    setPendingLetter(letter);
    try {
      const res = await fetch("/api/guess-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: puzzle.date, letter }),
      });
      const data = await res.json();

      if (data.correct) {
        setLetterStates((prev) => ({ ...prev, [letter]: "correct" }));
        setRevealedPositions((prev) => {
          const next = { ...prev };
          data.positions.forEach((p: number) => {
            next[p] = letter;
          });
          if (Object.keys(next).length === totalLetters) {
            finishGame(true, wrongGuesses);
          }
          return next;
        });
      } else {
        setLetterStates((prev) => ({ ...prev, [letter]: "wrong" }));
        const newWrongGuesses = wrongGuesses + 1;
        setWrongGuesses(newWrongGuesses);
        if (newWrongGuesses >= TOTAL_LIVES) {
          finishGame(false, newWrongGuesses);
        } else {
          unlockNextClue(newWrongGuesses);
        }
      }
    } finally {
      setPendingLetter(null);
    }
  }

  async function submitNameGuess(e: React.FormEvent) {
    e.preventDefault();
    if (!puzzle || status !== "playing" || !nameGuess.trim()) return;

    const res = await fetch("/api/guess-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: puzzle.date, guess: nameGuess }),
    });
    const data = await res.json();

    if (data.correct) {
      finishGame(true, wrongGuesses, data.name);
    } else {
      const newWrongGuesses = wrongGuesses + 1;
      setWrongGuesses(newWrongGuesses);
      setNameGuess("");
      if (newWrongGuesses >= TOTAL_LIVES) {
        finishGame(false, newWrongGuesses);
      } else {
        unlockNextClue(newWrongGuesses);
      }
    }
  }

  function currentShareText(): string {
    if (!puzzle) return "";
    return buildShareText(
      {
        date: puzzle.date,
        won: status === "won",
        livesLost: wrongGuesses,
        cluesUsed: clues.length,
        firstClueText: clues[0]?.text ?? "",
      },
      puzzle.puzzleNumber
    );
  }

  function openShareWindow(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
  }

  function shareToX() {
    openShareWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(currentShareText())}`);
  }

  function shareToWhatsApp() {
    openShareWindow(`https://wa.me/?text=${encodeURIComponent(currentShareText())}`);
  }

  function shareToFacebook() {
    const pageUrl = typeof window !== "undefined" ? window.location.origin : "";
    openShareWindow(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}&quote=${encodeURIComponent(
        currentShareText()
      )}`
    );
  }

  async function shareNative() {
    const text = currentShareText();
    try {
      await navigator.share({ text });
    } catch {
      // user cancelled or share failed; no-op
    }
  }

  function copyShare() {
    navigator.clipboard.writeText(currentShareText());
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  const canNativeShare = typeof window !== "undefined" && typeof navigator.share === "function";

  if (status === "loading" || !puzzle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <p>Loading today&apos;s puzzle&hellip;</p>
      </main>
    );
  }

  // Build the blank-cell layout: word groups separated by a gap, flat index
  // matches the server's letterPositions() indexing (letters + single spaces).
  const wordCells: { flatIndex: number; letter: string | null }[][] = [];
  {
    let flatIndex = 0;
    puzzle.words.forEach((len, wordIdx) => {
      const cells = [];
      for (let j = 0; j < len; j++) {
        cells.push({ flatIndex, letter: null });
        flatIndex++;
      }
      wordCells.push(cells);
      if (wordIdx < puzzle.words.length - 1) flatIndex++; // space
    });
  }

  const livesRemaining = TOTAL_LIVES - wrongGuesses;

  // Once the game ends, the revealed name (if known) is the source of truth for
  // every cell, not just the ones the player personally guessed.
  const displayPositions: Record<number, string> =
    (status === "won" || status === "lost") && revealedName
      ? Object.fromEntries(
          Array.from(revealedName).map((ch, i) => [i, ch]).filter(([, ch]) => ch !== " ")
        )
      : revealedPositions;

  return (
    <main className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-2xl flex flex-col gap-6">
        <header className="relative text-center">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cluebrity</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Puzzle #{puzzle.puzzleNumber} &middot; {puzzle.date}
          </p>
        </header>

        <div className="mx-auto w-full max-w-xs text-center text-xs text-neutral-500 dark:text-neutral-400">
          {syncCode ? (
            <p>
              Synced with code{" "}
              <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                {syncCode}
              </span>
            </p>
          ) : (
            <>
              <p className="mb-2">Want to save your progress or sync across devices?</p>
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <button
                  onClick={createSyncCode}
                  disabled={syncBusy}
                  className="rounded-full bg-neutral-200 px-3 py-1.5 font-semibold text-neutral-900 hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                >
                  Get a sync code
                </button>
                <form onSubmit={linkSyncCode} className="flex gap-1">
                  <input
                    type="text"
                    value={syncCodeInput}
                    onChange={(e) => setSyncCodeInput(e.target.value)}
                    placeholder="Enter a code"
                    className="w-32 rounded bg-neutral-100 px-2 py-1.5 text-xs outline-none ring-1 ring-neutral-300 focus:ring-neutral-500 dark:bg-neutral-900 dark:ring-neutral-700 dark:focus:ring-neutral-400"
                  />
                  <button
                    type="submit"
                    disabled={syncBusy}
                    className="rounded bg-neutral-200 px-2 py-1.5 font-semibold hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                  >
                    Link
                  </button>
                </form>
              </div>
            </>
          )}
          {syncMessage && <p className="mt-2">{syncMessage}</p>}
        </div>

        <div className="flex justify-center gap-1" aria-label="Lives remaining">
          {Array.from({ length: TOTAL_LIVES }, (_, i) => (
            <span key={i} className="text-xl">
              {i < livesRemaining ? "❤️" : "🖤"}
            </span>
          ))}
        </div>

        <section className="flex flex-wrap justify-center gap-x-3 gap-y-2">
          {wordCells.map((word, wi) => (
            <div key={wi} className="flex gap-1">
              {word.map(({ flatIndex }) => {
                const letter = displayPositions[flatIndex];
                return (
                  <div
                    key={flatIndex}
                    className="flex h-10 w-8 items-center justify-center border-b-2 border-neutral-400 dark:border-neutral-500 text-lg font-semibold uppercase"
                  >
                    {letter ?? ""}
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        {(status === "won" || status === "lost") && revealedName && (
          <div className="text-center">
            <p className="text-xl font-bold">{revealedName}</p>
          </div>
        )}

        <section className="flex flex-col gap-2" aria-label="Clues">
          {clues.map((clue) => (
            <div
              key={clue.level}
              className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200"
            >
              {clue.text}
            </div>
          ))}
        </section>

        {status === "playing" && (
          <>
            <div className="grid grid-cols-9 gap-1 sm:grid-cols-13">
              {ALPHABET.map((letter) => {
                const state = letterStates[letter];
                return (
                  <button
                    key={letter}
                    disabled={!!state || pendingLetter === letter}
                    onClick={() => guessLetter(letter)}
                    className={`h-10 rounded font-semibold text-sm transition-colors ${
                      state === "correct"
                        ? "bg-green-600 text-white"
                        : state === "wrong"
                        ? "bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
                        : "bg-neutral-200 hover:bg-neutral-300 text-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:text-white"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <form onSubmit={submitNameGuess} className="flex gap-2">
              <input
                type="text"
                value={nameGuess}
                onChange={(e) => setNameGuess(e.target.value)}
                placeholder="Guess the full name"
                className="flex-1 rounded bg-neutral-100 dark:bg-neutral-900 px-3 py-2 text-sm outline-none ring-1 ring-neutral-300 focus:ring-neutral-500 dark:ring-neutral-700 dark:focus:ring-neutral-400"
              />
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
              >
                Guess Name
              </button>
            </form>
          </>
        )}

        {(status === "won" || status === "lost") && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg font-semibold">
              {status === "won" ? "🎉 You got it!" : "Better luck tomorrow!"}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={shareToX}
                aria-label="Share on X"
                title="Share on X"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                <XIcon />
              </button>
              <button
                onClick={shareToWhatsApp}
                aria-label="Share on WhatsApp"
                title="Share on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-green-600 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-green-400 dark:hover:bg-neutral-700"
              >
                <WhatsAppIcon />
              </button>
              <button
                onClick={shareToFacebook}
                aria-label="Share on Facebook"
                title="Share on Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-blue-600 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-blue-400 dark:hover:bg-neutral-700"
              >
                <FacebookIcon />
              </button>
              {canNativeShare && (
                <button
                  onClick={shareNative}
                  aria-label="More share options"
                  title="More share options"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <ShareGenericIcon />
                </button>
              )}
              <button
                onClick={copyShare}
                aria-label="Copy result to clipboard"
                title="Copy result to clipboard"
                className="flex h-9 items-center gap-1.5 rounded-full bg-neutral-200 px-3 text-sm font-semibold hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                <CopyIcon />
                {shareCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            {stats && (
              <div className="flex gap-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                <div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{stats.played}</div>
                  Played
                </div>
                <div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%
                  </div>
                  Win Rate
                </div>
                <div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {stats.currentStreak}
                  </div>
                  Streak
                </div>
                <div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{stats.maxStreak}</div>
                  Max Streak
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
