"use client";

import { useEffect, useMemo, useState } from "react";
import type { Clue } from "@/lib/types";
import { buildShareText, recordResult, type Stats, loadStats } from "@/lib/gameStats";
import { XIcon, WhatsAppIcon, FacebookIcon, CopyIcon, ShareGenericIcon } from "@/components/ShareIcons";

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
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
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
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-2xl flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Cluebrity</h1>
          <p className="text-sm text-neutral-400">
            Puzzle #{puzzle.puzzleNumber} &middot; {puzzle.date}
          </p>
        </header>

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
                    className="flex h-10 w-8 items-center justify-center border-b-2 border-neutral-500 text-lg font-semibold uppercase"
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
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-200"
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
                        ? "bg-neutral-800 text-neutral-500"
                        : "bg-neutral-700 hover:bg-neutral-600 text-white"
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
                className="flex-1 rounded bg-neutral-900 px-3 py-2 text-sm outline-none ring-1 ring-neutral-700 focus:ring-neutral-400"
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
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 hover:bg-neutral-700"
              >
                <XIcon />
              </button>
              <button
                onClick={shareToWhatsApp}
                aria-label="Share on WhatsApp"
                title="Share on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-green-400 hover:bg-neutral-700"
              >
                <WhatsAppIcon />
              </button>
              <button
                onClick={shareToFacebook}
                aria-label="Share on Facebook"
                title="Share on Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-blue-400 hover:bg-neutral-700"
              >
                <FacebookIcon />
              </button>
              {canNativeShare && (
                <button
                  onClick={shareNative}
                  aria-label="More share options"
                  title="More share options"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 hover:bg-neutral-700"
                >
                  <ShareGenericIcon />
                </button>
              )}
              <button
                onClick={copyShare}
                aria-label="Copy result to clipboard"
                title="Copy result to clipboard"
                className="flex h-9 items-center gap-1.5 rounded-full bg-neutral-800 px-3 text-sm font-semibold hover:bg-neutral-700"
              >
                <CopyIcon />
                {shareCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            {stats && (
              <div className="flex gap-6 text-center text-sm text-neutral-400">
                <div>
                  <div className="text-lg font-bold text-neutral-100">{stats.played}</div>
                  Played
                </div>
                <div>
                  <div className="text-lg font-bold text-neutral-100">
                    {stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%
                  </div>
                  Win Rate
                </div>
                <div>
                  <div className="text-lg font-bold text-neutral-100">
                    {stats.currentStreak}
                  </div>
                  Streak
                </div>
                <div>
                  <div className="text-lg font-bold text-neutral-100">{stats.maxStreak}</div>
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
