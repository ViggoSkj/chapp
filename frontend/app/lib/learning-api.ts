export type LanguageText = { text: string; language: string };
export type LearningPage = {
  key: string; page: string; mode: string; revealed: boolean;
  exercise_id?: string; attempt_id?: string; content: LanguageText[];
};
export type LearningReply = { reply: LanguageText; pronunciation?: LanguageText | null };

async function learningResponse(path: string, body: unknown, signal?: AbortSignal, accept = "application/json"): Promise<Response> {
  const response = await fetch("/chapbackend-api" + path, {
    method: "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "X-Chapp-Request": "1", Accept: accept },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in to ask questions and explore characters.");
    if (response.status === 403) throw new Error("Your account does not have access to this learning activity.");
    if (response.status === 404) throw new Error("This exercise is no longer available in your account.");
    if (response.status === 400 && (await response.clone().text()).includes("invalid-listening-content"))
      throw new Error("This saved listening exercise contains repeated filler. Generate a new exercise.");
    if (response.status === 400) throw new Error("Reveal the answer before exploring a character, then try again.");
    throw new Error("Learning help is unavailable right now. Please try again shortly.");
  }
  return response;
}

export async function learningApi<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return (await learningResponse(path, body, signal)).json() as Promise<T>;
}

/** Reads text frames incrementally, preserving UTF-8 characters across arbitrary network chunk boundaries. */
export async function streamLearningReply(body: unknown, onDelta: (text: string) => void, signal: AbortSignal): Promise<string> {
  const response = await learningResponse("/learning-help/stream", body, signal, "application/x-ndjson");
  if (!response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
    throw new Error("The chat reply is unavailable. Please try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let reply = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let newline: number;

      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        const frame = JSON.parse(line) as { type?: string; text?: unknown };

        if (frame.type === "done" && reply.trim()) return reply;
        if (frame.type !== "delta" || typeof frame.text !== "string" || reply.length + frame.text.length > 4000) {
          throw new Error("The reply was interrupted. Please try again.");
        }

        reply += frame.text;
        onDelta(reply);
      }

      if (done || pending.length > 32_768) throw new Error("The reply was interrupted. Please try again.");
    }
  } catch (failure) {
    if (signal.aborted) throw failure;
    throw new Error("The reply was interrupted. Please try again.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function helpContext(page: LearningPage, actions: string[]) {
  return { page: page.page, mode: page.mode, revealed: page.revealed,
    exercise_id: page.exercise_id, attempt_id: page.attempt_id,
    content: page.content, actions: actions.slice(-12) };
}
