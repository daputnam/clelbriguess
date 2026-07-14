// Normalize for comparison: lowercase, strip diacritics, so "é" matches a guessed "e".
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function wordLengths(name: string): number[] {
  return name.split(" ").map((word) => word.length);
}

export function letterPositions(name: string, letter: string): number[] {
  const normalizedName = normalize(name);
  const normalizedLetter = normalize(letter);
  const positions: number[] = [];
  for (let i = 0; i < normalizedName.length; i++) {
    if (normalizedName[i] === normalizedLetter) positions.push(i);
  }
  return positions;
}

export function namesMatch(guess: string, name: string, aliases: string[]): boolean {
  const normalizedGuess = normalize(guess.trim());
  const candidates = [name, ...aliases].map(normalize);
  return candidates.includes(normalizedGuess);
}
