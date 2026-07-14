export type Clue = {
  level: number;
  type: string;
  text: string;
};

export type Celebrity = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  clues: Clue[];
};

export type PuzzlePattern = {
  puzzleId: string;
  date: string;
  words: number[]; // length of each word in the name
  firstClue: Clue;
};

export type LetterGuessResult = {
  letter: string;
  correct: boolean;
  positions: number[]; // flat index into the full name string (spaces included) where this letter occurs
};

export type NameGuessResult = {
  correct: boolean;
};

export type ClueResult = {
  level: number;
  clue: Clue | null; // null if that level doesn't exist or isn't unlocked yet
};
