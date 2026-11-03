"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "./account";
import { listeningLengths, listeningFamiliarity, listeningHints, type ListeningOptions } from "../lib/listening";
import { requestId } from "../lib/api";
import { ExploreText, useLearningPage, useLearningSupport } from "./learning-support";
import { useCachedAudio } from "./use-cached-audio";
import { Icon } from "./icons";
import styles from "./language-practice.module.css";

type Question = { id: string; mandarin: string; difficulty: string; listening?: ListeningOptions | null };
type Answer = { id: string; exercise_id: string; text: string; submitted_at: string; dont_know?: boolean };
type Grade = { correctness: number; feedback: string; suggested_translation: string };
type Run = { id: string; state: string; result?: Grade; error_code?: string };
type Review = { answer: Answer; question: { id: string; content: { mandarin: string; english: string; pinyin: string }; difficulty: string; listening?: ListeningOptions | null }; assessments: Run[] };
type Difficulty = "beginner" | "intermediate" | "advanced";
const cx = (names: string) => names.split(/\s+/).map(name => styles[name] ?? name).join(" ");
class ApiError extends Error {
  constructor(message: string, readonly definitiveGenerationFailure = false) { super(message); }
}

async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/chapbackend-api${path}`, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: body === undefined ? {} : { "Content-Type": "application/json", "X-Chapp-Request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in through Neuron, then return to practice.");
    if (response.status === 403) throw new Error("Access unavailable. Your Neuron login must be linked to a manually created Chapp user.");
    const text = await response.text();
    const known = ["anki-not-configured", "openai-not-configured", "unmapped-note-type", "no-eligible-characters", "unknown-generated-character",
      "generation-incomplete-use-new-request", "invalid-character-policy", "invalid-generated-question", "disallowed-generated-character", "dependency-failed",
      "anki-read-failed", "anki-action-failed", "openai-request-failed", "incomplete-provider-response", "provider-refused-or-empty",
      "source-field-schema-changed", "unsupported-expression-format", "invalid-mapped-expression", "source-too-large-narrow-selection-required"];
    const code = known.find(value => text.includes(value));
    if (text.includes("no-familiar-listening-characters")) throw new ApiError("No reviewed characters meet this familiarity setting yet. Try a higher character difficulty, or keep reviewing in Anki. The easiest setting uses cards with at least 21 days between reviews and no recent practice mistakes.", true);
    if (text.includes("listening-length-mismatch")) throw new ApiError("The generated sentence did not fit your selected length. Please generate a new one.", true);
    if (text.includes("invalid-listening-options")) throw new ApiError("Choose a supported length and character difficulty, then try again.", true);
    throw new ApiError(code ? `Practice unavailable: ${code}.` : `The request could not complete (${response.status}). Your saved submissions remain available in history.`, !!code);
  }
  if (!response.headers.get("content-type")?.includes("json")) throw new Error("The Chapp backend is not connected to this website yet.");
  return response.json() as Promise<T>;
}

export function SentenceExercise({ practiceQueue = false, listeningPractice = false }: { practiceQueue?: boolean; listeningPractice?: boolean }) {
  const { state } = useAccount();
  const pagePath = listeningPractice ? "/listening" : practiceQueue ? "/practice" : "/sentences";
  const [lengthLevel, setLengthLevel] = useState(0);
  const [characterDifficulty, setCharacterDifficulty] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [history, setHistory] = useState<Answer[]>([]);
  const [failedQuestions, setFailedQuestions] = useState<Question[]>([]);
  const [queueOffset, setQueueOffset] = useState(0);
  const [queueHasMore, setQueueHasMore] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const queueRequest = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState("Connecting…");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [rate, setRate] = useState(0.8);
  const sound = useCachedAudio(state + ":" + (question?.id ?? "sentence"));
  const { action } = useLearningSupport();
  const submission = useRef<{ submission_id: string; text: string; dont_know?: boolean } | null>(null);
  const retryId = useRef<string | null>(null);
  const generationId = useRef<string | null>(null);
  const audioFirst = question ? !!question.listening : listeningPractice;
  const displayText = review?.question.content.mandarin ?? question?.mandarin ?? "";
  const completed = review?.assessments.find(run => run.state === "completed" && run.result);

  const loadFailedQuestions = useCallback(async (offset: number) => {
    queueRequest.current?.abort();
    const controller = new AbortController(); queueRequest.current = controller;
    setQueueLoading(true); setQueueError("");
    try {
      const items = await api<Question[]>("/exercises/failed?offset=" + offset + "&limit=21", undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (!Array.isArray(items)) throw new Error("Your practice queue could not load. Please try again.");
      setFailedQuestions(items.slice(0, 20)); setQueueHasMore(items.length > 20 && offset < 10000); setQueueOffset(offset);
    } catch (failure) {
      if (!controller.signal.aborted) setQueueError(failure instanceof Error ? failure.message : "Your practice queue could not load.");
    } finally { if (!controller.signal.aborted) setQueueLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (state !== "signed-in") return;
      if (practiceQueue) void loadFailedQuestions(0);
      // Saved questions remain usable independently of source refresh and generation availability.
      void api<{ source_state: string; source_error?: string }>("/login-completions", {}).then(login => {
        if (active && login.source_state !== "ready") setNotice("Anki refresh is unavailable. You can still revisit saved questions; generation may use the last loaded source.");
      }).catch(() => { if (active) setNotice("Anki refresh is unavailable. Saved questions and answers remain available."); });
      try {
        const items = await api<Answer[]>("/attempts?offset=0&limit=20");
        if (!active) return;
        setHistory(items);
        const query = new URLSearchParams(window.location.search);
        const attemptId = query.get("attempt");
        const exerciseId = query.get("exercise");
        if (attemptId) {
          const saved = await api<Review>("/attempts/" + encodeURIComponent(attemptId));
          if (!active) return;
          setReview(saved); setAnswer(saved.answer.text);
          setQuestion({ id: saved.question.id, mandarin: saved.question.content.mandarin, difficulty: saved.question.difficulty, listening: saved.question.listening });
          if (saved.question.listening) { setLengthLevel(saved.question.listening.length_level); setCharacterDifficulty(saved.question.listening.character_difficulty); }
        } else if (exerciseId) {
          const saved = await api<Question>("/exercises/" + encodeURIComponent(exerciseId));
          if (active) {
            setQuestion(saved);
            if (saved.listening) { setLengthLevel(saved.listening.length_level); setCharacterDifficulty(saved.listening.character_difficulty); }
          }
        }
      } catch (failure) { if (active) setError(message(failure)); }
      finally { if (active) { setReady(true); setBusy(""); } }
    }
    void initialize();
    return () => { active = false; queueRequest.current?.abort(); };
  }, [state, practiceQueue, loadFailedQuestions]);

  function message(failure: unknown) { return failure instanceof Error ? failure.message : "The request failed. Please try again."; }
  function remember(kind: "exercise" | "attempt", id: string) {
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set(kind, id);
    window.history.replaceState(null, "", url);
  }
  useLearningPage({ key: question?.id ?? pagePath, page: pagePath, mode: audioFirst ? "listening-practice" : practiceQueue ? "daily-practice" : "sentence-practice",
    revealed: !!review, exercise_id: question?.id, attempt_id: review?.answer.id,
    content: question && (!audioFirst || review) ? [{ text: displayText, language: "zh-Hans" }] : [] });
  function record(kind: string) {
    action(kind);
    if (!question) return;
    void api("/exercises/" + question.id + "/events", { event_id: requestId(), kind,
      client_time: new Date().toISOString(), voice: "configured-server-voice", language: "zh", playback_rate: rate }).catch(() => {});
  }
  function stop() { sound.stop(); record("audio-stopped"); }
  async function listen() {
    if (!question) return;
    record("audio-requested");
    if (await sound.play("/exercises/" + question.id + "/sound", {}, rate, () => record("audio-ended"))) record("audio-started");
  }
  async function generate() {
    stop(); setBusy(listeningPractice ? "Preparing listening practice…" : "Generating sentence…"); setError("");
    generationId.current ??= requestId();
    try {
      const next = await api<Question>("/exercises", { request_id: generationId.current, difficulty,
        ...(listeningPractice ? { listening: { length_level: lengthLevel, character_difficulty: characterDifficulty } } : {}) });
      action("Generated a new sentence"); setQuestion(next); setReview(null); setAnswer(""); submission.current = null; retryId.current = null;
      remember("exercise", next.id); generationId.current = null;
      void api(`/exercises/${next.id}/events`, { event_id: requestId(), kind: "question-displayed", client_time: new Date().toISOString() }).catch(() => {});
    } catch (failure) {
      setError(message(failure));
      // Keep the same key when the response is uncertain, so a network retry cannot pay for a duplicate generation.
      if (failure instanceof ApiError && failure.definitiveGenerationFailure) generationId.current = null;
    }
    finally { setBusy(""); }
  }
  async function submit(dontKnow = false) {
    if (!question || (!dontKnow && !answer.trim())) return;
    setBusy(dontKnow ? "Saving “Don’t know”…" : "Saving answer and assessing…"); setError("");
    // Keep the same key while retrying the same choice, so a network retry cannot save a duplicate attempt.
    if (dontKnow ? !submission.current?.dont_know : !submission.current || submission.current.dont_know || submission.current.text !== answer)
      submission.current = dontKnow ? { submission_id: requestId(), text: "", dont_know: true } : { submission_id: requestId(), text: answer };
    try {
      const saved = await api<Review>(`/exercises/${question.id}/attempts`, submission.current);
      action(dontKnow ? "Chose “Don’t know” and revealed the review" : "Submitted an answer and revealed the review"); setReview(saved); remember("attempt", saved.answer.id);
      if (dontKnow) setAnswer("");
      setHistory(items => [saved.answer, ...items.filter(item => item.id !== saved.answer.id)].slice(0, 20));
      if (practiceQueue) void loadFailedQuestions(0);
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(""); }
  }
  async function retry() {
    if (!review) return;
    setBusy("Retrying assessment…"); setError(""); retryId.current ??= requestId();
    try {
      const saved = await api<Review>("/attempts/" + review.answer.id + "/assessment-retries", { request_id: retryId.current });
      setReview(saved); retryId.current = null;
      if (practiceQueue) void loadFailedQuestions(0);
    }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(""); }
  }
  async function openAttempt(id: string) {
    stop(); setBusy("Opening saved attempt…"); setError("");
    try {
      const saved = await api<Review>(`/attempts/${id}`); setReview(saved); setAnswer(saved.answer.text);
      setQuestion({ id: saved.question.id, mandarin: saved.question.content.mandarin, difficulty: saved.question.difficulty, listening: saved.question.listening });
          if (saved.question.listening) { setLengthLevel(saved.question.listening.length_level); setCharacterDifficulty(saved.question.listening.character_difficulty); }
      action("Opened a saved attempt"); remember("attempt", id); retryId.current = null;
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(""); }
  }

  function revisit(saved: Question) {
    stop();
    if (saved.listening) { setLengthLevel(saved.listening.length_level); setCharacterDifficulty(saved.listening.character_difficulty); }
    setQuestion(saved); setReview(null); setAnswer(""); setError("");
    submission.current = null; retryId.current = null; generationId.current = null;
    remember("exercise", saved.id);
    action("Started another attempt at a saved question");
  }
  if (state !== "signed-in") return <section className="panel detail-panel"><h1>{state === "loading" ? "Checking your account…" : "Sign in to practice"}</h1><p>{state === "unlinked" ? "Your Neuron login needs to be linked to a learner account." : "Your sentences and saved answers stay with your account."}</p><Link className="button primary" href={state === "unlinked" ? "/connections" : "/login"}>{state === "unlinked" ? "View account" : "Sign in"}</Link></section>;

  return <div className={cx("language-practice")}>
    <div className={cx("page-heading")}><div><div className={cx("eyebrow")}>APPLY WHAT YOU KNOW</div><h1>{listeningPractice ? "A little closer. A little clearer." : practiceQueue ? "Your next step in Mandarin." : "One sentence at a time."}</h1><p>{listeningPractice ? "Listen to Mandarin built from your reviewed characters. Start small, write the meaning, then explore what you heard." : practiceQueue ? "Revisit a question that needs practice, or try a new sentence." : "Translate a Mandarin sentence into English. New sentences give extra emphasis to characters from recent mistakes, using only your reviewed Anki vocabulary."}</p></div><Link href={practiceQueue ? "/sentences" : "/practice"} className={cx("button secondary")}>{practiceQueue ? "Sentence practice" : "All practice"} <Icon name="arrow" size={16} /></Link></div>
    {listeningPractice && <div className={cx("practice-page-links")}><Link href="/sentences"><Icon name="book" size={17} />Sentence practice</Link><Link href="/listening" aria-current="page"><Icon name="sound" size={17} />Listening practice</Link></div>}
    {error && <p className={cx("speech-status")} role="alert">{error}</p>}
    {notice && <p className={cx("speech-status")} role="status">{notice}</p>}
    {practiceQueue && <section className={cx("panel exercise-panel queue-panel")} aria-busy={queueLoading} aria-label="Your practice queue">
      <div className={cx("exercise-toolbar")}><div><h2>Your practice queue</h2><p>Revisit sentences where your last graded answer missed some meaning.</p></div><button className={cx("button secondary")} disabled={queueLoading} onClick={() => void loadFailedQuestions(queueOffset)}>Refresh queue</button></div>
      <div className={cx("exercise-body")}>
        <div className={cx("queue-actions")}>
          <button className={cx("button primary")} disabled={!!busy || queueLoading || !failedQuestions.length || !!queueError} onClick={() => revisit(failedQuestions[0])}>Retry next question</button>
          <button className={cx("button secondary")} disabled={!!busy || !ready} onClick={() => void generate()}><Icon name="spark" size={17} />Generate a new sentence</button>
        </div>
        {queueLoading && <p className={cx("queue-status")} role="status">Loading your saved questions…</p>}
        {queueError ? <div className={cx("queue-status")} role="alert"><p>{queueError}</p><button className={cx("button secondary")} disabled={queueLoading} onClick={() => void loadFailedQuestions(queueOffset)}>Reload practice queue</button></div>
          : !queueLoading && !failedQuestions.length ? <p className={cx("queue-status")}>No questions to revisit on this page. Generate a new sentence whenever you’re ready.</p> : null}
        {!queueError && failedQuestions.length > 0 && <ul className={cx("queue-list")}>{failedQuestions.map(item => <li key={item.id}>
          <div><p lang="zh-Hans">{item.listening ? "Listening sentence · " + listeningLengths[item.listening.length_level] : item.mandarin}</p><small>{item.difficulty}</small></div>
          <button className={cx("button secondary")} disabled={!!busy || queueLoading} onClick={() => revisit(item)} aria-label={item.listening ? "Retry listening sentence" : "Retry sentence " + item.mandarin}>Try again</button>
        </li>)}</ul>}
        <div className={cx("queue-pagination")}>
          <button className={cx("button secondary")} disabled={queueLoading || queueOffset === 0} onClick={() => void loadFailedQuestions(Math.max(0, queueOffset - 20))}>Previous questions</button>
          <span>{queueOffset ? "Page " + (Math.floor(queueOffset / 20) + 1) : "Most recent first"}</span>
          <button className={cx("button secondary")} disabled={queueLoading || !queueHasMore || !!queueError} onClick={() => void loadFailedQuestions(queueOffset + 20)}>More questions</button>
        </div>
      </div>
    </section>}
    <section className={cx("panel exercise-panel")} aria-busy={!!busy}>
      <div className={cx("exercise-toolbar")}><div><h2>{listeningPractice ? "Your listening studio" : "Mandarin to English"}</h2><p>{listeningPractice ? "Two small adjustments. A listening challenge that fits you." : "AI sentences constrained to characters from your eligible Anki content."}</p></div>{!listeningPractice && <label className={cx("difficulty-select")}>Next sentence difficulty<select value={difficulty} disabled={!!busy} onChange={event => { setDifficulty(event.target.value as Difficulty); generationId.current = null; }}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>}</div>
      {listeningPractice && <div className={cx("listening-settings")} aria-label="Next listening exercise settings">
        <label className={cx("listening-slider")} htmlFor="listening-length"><span>Sentence length<output htmlFor="listening-length">{listeningLengths[lengthLevel]}</output></span>
          <input id="listening-length" aria-label="Sentence length" type="range" min={0} max={4} step={1} value={lengthLevel} aria-valuetext={listeningLengths[lengthLevel]} disabled={!!busy} onChange={event => { setLengthLevel(Number(event.target.value)); generationId.current = null; }} />
          <span className={cx("slider-scale")}><small>A short phrase</small><small>A longer sentence</small></span>
        </label>
        <label className={cx("listening-slider")} htmlFor="listening-difficulty"><span>Character difficulty<output htmlFor="listening-difficulty">{listeningFamiliarity[characterDifficulty]}</output></span>
          <input id="listening-difficulty" aria-label="Character difficulty" type="range" min={0} max={4} step={1} value={characterDifficulty} aria-valuetext={listeningFamiliarity[characterDifficulty]} disabled={!!busy} onChange={event => { setCharacterDifficulty(Number(event.target.value)); generationId.current = null; }} />
          <span className={cx("slider-scale")}><small>Know well</small><small>More challenging</small></span>
        </label>
        <p className={cx("listening-settings-note")}>{listeningHints[characterDifficulty]} Length counts Chinese characters, excluding punctuation. Changes apply to your next exercise.</p>
        <details className={cx("listening-familiarity-note")}><summary>How familiarity works</summary><p>The easiest setting uses reviewed Anki cards with intervals of at least 21 days and excludes characters flagged by recent sentence results. Higher settings widen that boundary to 14, 7, 3 days, then all reviewed characters. This estimates familiarity from words and sentence results; it does not measure each character’s mastery. Missing review intervals never qualify for the easiest setting.</p></details>
      </div>}

      <div className={cx("exercise-body")}>
        {question ? <>
          <div className={cx("exercise-meta")}><span className={cx("eyebrow")}>{audioFirst ? "LISTEN. WHAT DOES IT MEAN?" : "WHAT DOES THIS SENTENCE MEAN?"}</span><span className={cx("exercise-level")}>{question.listening ? listeningLengths[question.listening.length_level] : question.difficulty}</span></div>
          {audioFirst && !review ? <div className={cx("listening-stage")}><span className={cx("listening-orb")} data-playing={sound.playing}><Icon name="sound" size={36} /></span><h3>{sound.playing ? "Listen closely…" : "Let your ears lead."}</h3><p>The Chinese, pinyin and meaning stay hidden until you answer.</p></div>
            : <p className={cx("sentence-prompt")} lang="zh-CN"><ExploreText text={displayText} enabled={!!review} activeIndex={sound.spokenText === displayText ? sound.activeCharacterIndex : null} /></p>}
          <div className={cx("listen-actions")}><button className={cx("button secondary")} disabled={sound.loading || !!busy} onClick={() => void listen()}><Icon name="sound" size={18} />{sound.loading ? "Loading audio…" : sound.playing ? "Replay" : "Listen"}</button>{sound.playing && <button className={cx("button secondary")} onClick={stop}>Stop</button>}</div>
          <label className={cx("translation-draft")}>{audioFirst ? "What did you hear? Write the meaning in English" : "Your English translation"}<textarea value={answer} disabled={!!busy || !!review} onChange={event => setAnswer(event.target.value)} maxLength={8000} rows={4} placeholder="Write the meaning in your own words…" /></label>
          {!review && <div className={cx("listen-actions")}><button className={cx("button primary")} disabled={!!busy || !answer.trim()} onClick={() => void submit()}>Submit for grading</button><button className={cx("button secondary")} disabled={!!busy} onClick={() => void submit(true)}>Don’t know</button></div>}
          {review && <div className={cx("character-feedback")} role="status"><p><strong>Reference:</strong> {review.question.content.english}</p><p lang="zh-Latn-pinyin">{review.question.content.pinyin}</p>{review.answer.dont_know && <p><strong>You chose “Don’t know”.</strong> This counts as 0 and the sentence stays in your practice queue.</p>}{completed?.result ? <><strong>Correctness: {completed.result.correctness.toFixed(2)} / 1</strong>{!review.answer.dont_know && <><p>{completed.result.feedback}</p><p><strong>Suggested translation:</strong> {completed.result.suggested_translation}</p></>}</> : <><strong>Your answer is saved.</strong><p>Assessment is {review.assessments[0]?.state ?? "pending"}. This has not been counted as an incorrect answer.</p><button className={cx("button secondary")} disabled={!!busy} onClick={() => void retry()}>Retry assessment</button></>}</div>}
        </> : <p>{practiceQueue ? "Choose a saved question above, or generate a new sentence. Every new answer is saved as a separate attempt." : listeningPractice ? "Start with a short phrase and familiar characters. Generate your first listening exercise when you’re ready." : "Generate a sentence when you’re ready. Your answer and feedback will be saved to your Chapp account."}</p>}
        <div className={cx("exercise-bottom")}><span role="status">{busy || (review ? "Saved to your account" : "Meaning matters; imperfect English is welcome.")}</span><button className={cx("button primary")} disabled={!!busy || !ready} onClick={() => void generate()}><Icon name="spark" size={17} />{listeningPractice ? question ? "Next listening exercise" : "Start listening practice" : question ? "Generate next sentence" : "Generate sentence"}</button></div>
      </div>
      {sound.error && <p className={cx("speech-status")} role="alert">{sound.error}</p>}
      <details className={cx("audio-settings")}><summary>Audio settings</summary><div className={cx("audio-controls")}><label>Playback speed<select value={rate} onChange={event => { stop(); setRate(Number(event.target.value)); }}><option value={0.65}>Extra slow</option><option value={0.8}>Slow</option><option value={1}>Normal</option></select></label></div></details>
    </section>
    <section className={cx("panel exercise-panel")} style={{ marginTop: 24 }}><div className={cx("exercise-toolbar")}><div><h2>Saved attempts</h2><p>Your most recent submissions, including answers awaiting grading.</p></div></div><div className={cx("exercise-body")}>{history.length ? <ul>{history.map(item => <li key={item.id}><button className={cx("button secondary")} disabled={!!busy} onClick={() => void openAttempt(item.id)}>{item.dont_know ? "Don’t know" : item.text.slice(0, 90)} · {new Date(item.submitted_at).toLocaleString()}</button></li>)}</ul> : <p>No submitted answers yet.</p>}</div></section>
  </div>;
}
