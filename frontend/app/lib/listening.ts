/** Independent length bands count Han characters, including repeats; punctuation is excluded. */
export const listeningLengths = ["3–5 characters", "6–10 characters", "11–20 characters", "21–35 characters", "36–60 characters"] as const;
export const listeningFamiliarity = ["Characters I know well", "Very familiar", "Familiar", "More variety", "All reviewed characters"] as const;
export const listeningHints = [
  "Your strongest reviewed characters, excluding characters from recent practice mistakes.",
  "Characters from reviewed cards with at least two weeks between reviews.",
  "Characters from reviewed cards with at least a week between reviews.",
  "More recently reviewed characters, with at least three days between reviews.",
  "Your full reviewed Anki character set. New and learning cards stay excluded.",
] as const;
export type ListeningOptions = { length_level: number; character_difficulty: number };
