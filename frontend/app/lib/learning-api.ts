export type LanguageText = { text: string; language: string };
export type LearningPage = {
  key: string; page: string; mode: string; revealed: boolean;
  exercise_id?: string; attempt_id?: string; content: LanguageText[];
};
export type LearningReply = { reply: LanguageText; pronunciation?: LanguageText | null };

export async function learningApi<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/chapbackend-api" + path, {
    method: "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "X-Chapp-Request": "1" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in to ask questions and explore characters.");
    if (response.status === 403) throw new Error("Your account does not have access to this learning activity.");
    if (response.status === 404) throw new Error("This exercise is no longer available in your account.");
    if (response.status === 400) throw new Error("Reveal the answer before exploring a character, then try again.");
    throw new Error("Learning help is unavailable right now. Please try again shortly.");
  }
  return response.json() as Promise<T>;
}

export function helpContext(page: LearningPage, actions: string[]) {
  return { page: page.page, mode: page.mode, revealed: page.revealed,
    exercise_id: page.exercise_id, attempt_id: page.attempt_id,
    content: page.content, actions: actions.slice(-12) };
}
