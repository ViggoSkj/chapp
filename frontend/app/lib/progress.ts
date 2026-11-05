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
  measurements?: {
    listening_plays: number;
    played_listening_exercises: number;
    median_plays_per_listening_exercise: number | null;
    median_reading_milliseconds: number | null;
    median_reverse_milliseconds: number | null;
    median_listening_milliseconds: number | null;
    median_grading_milliseconds: number | null;
  } | null;
};
