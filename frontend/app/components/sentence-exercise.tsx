"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./account";
import { requestId } from "../lib/api";
import { ExploreText, useLearningPage, useLearningSupport } from "./learning-support";
import { useCachedAudio } from "./use-cached-audio";
import { Icon } from "./icons";
import styles from "./language-practice.module.css";

type Question = { id: string; mandarin: string; difficulty: string };
type Answer = { id: string; exercise_id: string; text: string; submitted_at: string };
type Grade = { correctness: number; feedback: string; suggested_translation: string };
type Run = { id: string; state: string; result?: Grade; error_code?: string };
type Review = { answer: Answer; question: { id: string; content: { mandarin: string; english: string; pinyin: string }; difficulty: string }; assessments: Run[] };
type Difficulty = "beginner" | "intermediate" | "advanced";
const cx = (names: string) => names.split(/\s+/).map(name => styles[name] ?? name).join(" ");
class ApiError extends Error {
  constructor(message: string, readonly definitiveGenerationFailure = false) { super(message); }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/chapbackend-api${path}`, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json", "X-Chapp-Request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in through Neuron, then return to sentence practice.");
    if (response.status === 403) throw new Error("Access unavailable. Your Neuron login must be linked to a manually created Chapp user.");
    const text = await response.text();
    const known = ["anki-not-configured", "openai-not-configured", "unmapped-note-type", "no-eligible-characters", "unknown-generated-character",
      "generation-incomplete-use-new-request", "invalid-generated-question", "disallowed-generated-character", "dependency-failed",
      "anki-read-failed", "anki-action-failed", "openai-request-failed", "incomplete-provider-response", "provider-refused-or-empty",
      "source-field-schema-changed", "unsupported-expression-format", "invalid-mapped-expression", "source-too-large-narrow-selection-required"];
    const code = known.find(value => text.includes(value));
    throw new ApiError(code ? `Practice unavailable: ${code}.` : `The request could not complete (${response.status}). Your saved submissions remain available in history.`, !!code);
  }
  if (!response.headers.get("content-type")?.includes("json")) throw new Error("The Chapp backend is not connected to this website yet.");
  return response.json() as Promise<T>;
}

export function SentenceExercise() {
  const { state } = useAccount();
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [history, setHistory] = useState<Answer[]>([]);
  const [busy, setBusy] = useState("Connecting…");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [rate, setRate] = useState(0.8);
  const sound = useCachedAudio(question?.id ?? "sentence");
  const { action } = useLearningSupport();
  const submission = useRef<{ submission_id: string; text: string } | null>(null);
  const retryId = useRef<string | null>(null);
  const generationId = useRef<string | null>(null);
  const completed = review?.assessments.find(run => run.state === "completed" && run.result);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (state !== "signed-in") return;
      try {
        const login = await api<{ source_state: string; source_error?: string }>("/login-completions", {});
        const items = await api<Answer[]>("/attempts?offset=0&limit=20");
        if (!active) return;
        setHistory(items); setReady(true);
        if (login.source_state !== "ready") setNotice(`Anki refresh is unavailable (${login.source_error ?? "source unavailable"}). A previously loaded source may still be usable.`);
        const query = new URLSearchParams(window.location.search);
        const attemptId = query.get("attempt");
        const exerciseId = query.get("exercise");
        if (attemptId) {
          const saved = await api<Review>(`/attempts/${encodeURIComponent(attemptId)}`);
          if (!active) return;
          setReview(saved); setAnswer(saved.answer.text);
          setQuestion({ id: saved.question.id, mandarin: saved.question.content.mandarin, difficulty: saved.question.difficulty });
        } else if (exerciseId) {
          const saved = await api<Question>(`/exercises/${encodeURIComponent(exerciseId)}`);
          if (active) setQuestion(saved);
        }
      } catch (failure) { if (active) setError(message(failure)); }
      finally { if (active) setBusy(""); }
    }
    void initialize();
    return () => { active = false; };
  }, [state]);

  function message(failure: unknown) { return failure instanceof Error ? failure.message : "The request failed. Please try again."; }
  function remember(kind: "exercise" | "attempt", id: string) {
    const url = new URL(window.location.href); url.search = ""; url.searchParams.set(kind, id);
    window.history.replaceState(null, "", url);
  }
  useLearningPage({ key: question?.id ?? "sentences", page: "/sentences", mode: "sentence-practice",
    revealed: !!review, exercise_id: question?.id, attempt_id: review?.answer.id,
    content: question ? [{ text: question.mandarin, language: "zh-Hans" }] : [] });
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
    stop(); setBusy("Generating sentence…"); setError("");
    generationId.current ??= requestId();
    try {
      const next = await api<Question>("/exercises", { request_id: generationId.current, difficulty });
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
  async function submit() {
    if (!question || !answer.trim()) return;
    setBusy("Saving answer and assessing…"); setError("");
    if (!submission.current || submission.current.text !== answer) submission.current = { submission_id: requestId(), text: answer };
    try {
      const saved = await api<Review>(`/exercises/${question.id}/attempts`, submission.current);
      action("Submitted an answer and revealed the review"); setReview(saved); remember("attempt", saved.answer.id);
      setHistory(items => [saved.answer, ...items.filter(item => item.id !== saved.answer.id)].slice(0, 20));
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(""); }
  }
  async function retry() {
    if (!review) return;
    setBusy("Retrying assessment…"); setError(""); retryId.current ??= requestId();
    try { setReview(await api<Review>(`/attempts/${review.answer.id}/assessment-retries`, { request_id: retryId.current })); retryId.current = null; }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(""); }
  }
  async function openAttempt(id: string) {
    stop(); setBusy("Opening saved attempt…"); setError("");
    try {
      const saved = await api<Review>(`/attempts/${id}`); setReview(saved); setAnswer(saved.answer.text);
      setQuestion({ id: saved.question.id, mandarin: saved.question.content.mandarin, difficulty: saved.question.difficulty });
      action("Opened a saved attempt"); remember("attempt", id); retryId.current = null;
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(""); }
  }

  if (state !== "signed-in") return <section className="panel detail-panel"><h1>{state === "loading" ? "Checking your account…" : "Sign in to practice"}</h1><p>{state === "unlinked" ? "Your Neuron login needs to be linked to a learner account." : "Your sentences and saved answers stay with your account."}</p><Link className="button primary" href={state === "unlinked" ? "/connections" : "/login"}>{state === "unlinked" ? "View account" : "Sign in"}</Link></section>;

  return <div className={cx("language-practice")}>
    <div className={cx("page-heading")}><div><div className={cx("eyebrow")}>APPLY WHAT YOU KNOW</div><h1>One sentence at a time.</h1><p>Translate a Mandarin sentence into English. Listen whenever it helps.</p></div><Link href="/practice" className={cx("button secondary")}>All practice <Icon name="arrow" size={16} /></Link></div>
    {error && <p className={cx("speech-status")} role="alert">{error}</p>}
    {notice && <p className={cx("speech-status")} role="status">{notice}</p>}
    <section className={cx("panel exercise-panel")} aria-busy={!!busy}>
      <div className={cx("exercise-toolbar")}><div><h2>Mandarin to English</h2><p>AI sentences constrained to characters from your eligible Anki content.</p></div><label className={cx("difficulty-select")}>Next sentence difficulty<select value={difficulty} disabled={!!busy} onChange={event => { setDifficulty(event.target.value as Difficulty); generationId.current = null; }}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>
      <div className={cx("exercise-body")}>
        {question ? <>
          <div className={cx("exercise-meta")}><span className={cx("eyebrow")}>WHAT DOES THIS SENTENCE MEAN?</span><span className={cx("exercise-level")}>{question.difficulty}</span></div>
          <p className={cx("sentence-prompt")} lang="zh-CN"><ExploreText text={question.mandarin} enabled={!!review} /></p>
          <div className={cx("listen-actions")}><button className={cx("button secondary")} disabled={sound.loading} onClick={() => void listen()}><Icon name="sound" size={18} />{sound.loading ? "Loading audio…" : sound.playing ? "Replay" : "Listen"}</button>{sound.playing && <button className={cx("button secondary")} onClick={stop}>Stop</button>}</div>
          <label className={cx("translation-draft")}>Your English translation<textarea value={answer} disabled={!!busy || !!review} onChange={event => setAnswer(event.target.value)} maxLength={8000} rows={4} placeholder="Write the meaning in your own words…" /></label>
          {!review && <button className={cx("button primary")} disabled={!!busy || !answer.trim()} onClick={() => void submit()}>Submit for grading</button>}
          {review && <div className={cx("character-feedback")} role="status"><p><strong>Reference:</strong> {review.question.content.english}</p><p lang="zh-Latn-pinyin">{review.question.content.pinyin}</p>{completed?.result ? <><strong>Correctness: {completed.result.correctness.toFixed(2)} / 1</strong><p>{completed.result.feedback}</p><p><strong>Suggested translation:</strong> {completed.result.suggested_translation}</p></> : <><strong>Your answer is saved.</strong><p>Assessment is {review.assessments[0]?.state ?? "pending"}. This has not been counted as an incorrect answer.</p><button className={cx("button secondary")} disabled={!!busy} onClick={() => void retry()}>Retry assessment</button></>}</div>}
        </> : <p>Generate a sentence when you’re ready. Your answer and feedback will be saved to your Chapp account.</p>}
        <div className={cx("exercise-bottom")}><span role="status">{busy || (review ? "Saved to your account" : "Meaning matters; imperfect English is welcome.")}</span><button className={cx("button primary")} disabled={!!busy || !ready} onClick={() => void generate()}><Icon name="spark" size={17} />{question ? "Generate next sentence" : "Generate sentence"}</button></div>
      </div>
      {sound.error && <p className={cx("speech-status")} role="alert">{sound.error}</p>}
      <details className={cx("audio-settings")}><summary>Audio settings</summary><div className={cx("audio-controls")}><label>Playback speed<select value={rate} onChange={event => { stop(); setRate(Number(event.target.value)); }}><option value={0.65}>Extra slow</option><option value={0.8}>Slow</option><option value={1}>Normal</option></select></label></div></details>
    </section>
    <section className={cx("panel exercise-panel")} style={{ marginTop: 24 }}><div className={cx("exercise-toolbar")}><div><h2>Saved attempts</h2><p>Your most recent submissions, including answers awaiting grading.</p></div></div><div className={cx("exercise-body")}>{history.length ? <ul>{history.map(item => <li key={item.id}><button className={cx("button secondary")} disabled={!!busy} onClick={() => void openAttempt(item.id)}>{item.text.slice(0, 90)} · {new Date(item.submitted_at).toLocaleString()}</button></li>)}</ul> : <p>No submitted answers yet.</p>}</div></section>
  </div>;
}
