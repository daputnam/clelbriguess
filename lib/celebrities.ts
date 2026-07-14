import data from "@/data/celebrities.json";
import type { Celebrity } from "./types";

export const celebrities: Celebrity[] = data.celebrities as Celebrity[];

export function getCelebrityById(id: string): Celebrity | undefined {
  return celebrities.find((c) => c.id === id);
}
