/** Independent length bands count Han characters, including repeats; punctuation is excluded. */
export const listeningLengths = ["3–5 characters", "6–10 characters", "11–20 characters", "21–35 characters", "36–60 characters"] as const;
export const listeningFamiliarity = ["Most familiar", "Mostly familiar", "Balanced", "More challenging", "Practice weak spots"] as const;
export const listeningHints = [
  "Prefer your most familiar reviewed vocabulary and simple, natural sentences.",
  "Favor familiar vocabulary, with a little more variety.",
  "Balance familiar characters with ones that need more practice.",
  "Give more attention to characters from recent mistakes.",
  "Use the same character emphasis as normal sentence practice.",
] as const;
export type ListeningOptions = { length_level: number; character_difficulty: number };
