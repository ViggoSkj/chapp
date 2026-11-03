export type PracticeActivityDay = {
  date: string;
  attempts: number;
  graded_attempts: number;
  fully_correct_attempts: number;
};

export type PracticeProgress = {
  as_of: string;
  total_attempts: number;
  graded_attempts: number;
  fully_correct_attempts: number;
  ungraded_attempts: number;
  average_correctness: number | null;
  questions_needing_practice: number;
  current_streak_days: number;
  best_streak_days: number;
  activity: PracticeActivityDay[];
};
