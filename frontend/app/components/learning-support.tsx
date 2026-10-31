"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAccount } from "./account";
import { useCachedAudio } from "./use-cached-audio";
import { helpContext, learningApi, type LearningPage, type LearningReply } from "../lib/learning-api";
import styles from "./learning-support.module.css";

type Support = { page: LearningPage; actions: string[]; publish: (page: LearningPage) => void;
  action: (label: string) => void; select: (character: string) => void };
const SupportContext = createContext<Support | null>(null);

export function LearningSupportProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [published, setPublished] = useState<LearningPage | null>(null);
  const [actionState, setActionState] = useState<{ key: string; items: string[] }>({ key: "", items: [] });
  const [chatOpen, setChatOpen] = useState(false);
  const [selected, setSelected] = useState<{ character: string; key: string } | null>(null);
  const publish = useCallback((page: LearningPage) => setPublished(page), []);
  const page = useMemo<LearningPage>(() => published?.page === pathname ? published :
    { key: pathname, page: pathname, mode: pathname.slice(1) || "overview", revealed: false, content: [] }, [published, pathname]);
  const contextKey = page.key + ":" + page.revealed + ":" + (page.attempt_id ?? "");
  const actionKey = page.page + ":" + page.key;
  const actions = useMemo(() => actionState.key === actionKey ? actionState.items : [], [actionState, actionKey]);
  const action = useCallback((label: string) => setActionState(current => ({ key: actionKey,
    items: [...(current.key === actionKey ? current.items : []), label.slice(0, 100)].slice(-12) })), [actionKey]);
  const select = useCallback((character: string) => {
    setSelected({ character, key: contextKey }); action("Selected character " + character);
  }, [action, contextKey]);
  const value = useMemo(() => ({ page, actions, publish, action, select }), [page, actions, publish, action, select]);

  return <SupportContext.Provider value={value}>{children}
    {selected?.key === contextKey && page.revealed && <CharacterDetails key={contextKey + selected.character}
      character={selected.character} page={page} actions={actions} close={() => setSelected(null)} action={action} />}
    <LearningChat key={contextKey} page={page} actions={actions} open={chatOpen} setOpen={setChatOpen} />
  </SupportContext.Provider>;
}

export function useLearningSupport() {
  const support = useContext(SupportContext);
  if (!support) throw new Error("Learning support is not available.");
  return support;
}

/** Publishes explicit visible data, never hidden references or arbitrary page HTML. */
export function useLearningPage(page: LearningPage) {
  const { publish } = useLearningSupport();
  const serialized = JSON.stringify(page);
  useEffect(() => { publish(JSON.parse(serialized) as LearningPage); }, [publish, serialized]);
}

export function ExploreText({ text, enabled }: { text: string; enabled?: boolean }) {
  const support = useLearningSupport();
  const active = enabled ?? support.page.revealed;
  return <>{Array.from(text).map((character, index) => active && /\p{Script=Han}/u.test(character)
    ? <button key={index} type="button" className={styles.character} aria-label={"Explore " + character}
        onClick={() => support.select(character)}>{character}</button>
    : <span key={index}>{character}</span>)}</>;
}

function CharacterDetails({ character, page, actions, close, action }: {
  character: string; page: LearningPage; actions: string[]; close: () => void; action: (value: string) => void;
}) {
  const { state } = useAccount();
  const [result, setResult] = useState<LearningReply | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sound = useCachedAudio(page.key + character);
  const payload = useRef({ context: helpContext(page, actions), character, message: "Explain this character in the visible phrase.", history: [] });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    if (state !== "signed-in") return;
    const controller = new AbortController();
    learningApi<LearningReply>("/learning-help", payload.current, controller.signal)
      .then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Character details are unavailable."); });
    return () => controller.abort();
  }, [state, retry]);

  return <section className={styles.characterCard} role="dialog" aria-label={"About " + character}
    onKeyDown={event => { if (event.key === "Escape") close(); }}>
    <div className={styles.cardHeading}><div><span className={styles.eyebrow}>EXPLORE A CHARACTER</span><h2 lang="zh-Hans">{character}</h2></div>
      <button ref={closeButton} type="button" className={styles.close} onClick={close} aria-label="Close character details">×</button></div>
    {state !== "signed-in" ? <p><Link href="/login">Sign in</Link> to see meanings and hear this character.</p> : <>
      {result?.pronunciation && <p className={styles.pinyin} lang={result.pronunciation.language}>{result.pronunciation.text}</p>}
      <button type="button" className={styles.secondary} disabled={sound.loading} onClick={async () => {
        if (sound.playing) { sound.stop(); return; }
        if (await sound.play("/learning-help/sound", payload.current)) action("Played character " + character);
      }}>{sound.loading ? "Loading audio…" : sound.playing ? "Stop audio" : "◖ Listen to character"}</button>
      <div aria-live="polite">{error ? <><p role="alert">{error}</p><button className={styles.secondary} onClick={() => { setError(""); setRetry(value => value + 1); }}>Try again</button></>
        : <p lang={result?.reply.language ?? "en"}>{result?.reply.text ?? "Finding meaning and pronunciation…"}</p>}</div>
      {sound.error && <p role="alert">{sound.error}</p>}<small>AI explanation · pronunciation can depend on the phrase.</small>
    </>}
  </section>;
}

function LearningChat({ page, actions, open, setOpen }: { page: LearningPage; actions: string[]; open: boolean; setOpen: (value: boolean) => void }) {
  const { state } = useAccount();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);
  async function send() {
    const text = draft.trim(); if (!text || busy) return;
    setBusy(true); setError(""); setDraft("");
    const previous = messages.slice(-8);
    setMessages(items => [...items, { role: "user", text }]);
    const request = new AbortController(); controller.current = request;
    try {
      const result = await learningApi<LearningReply>("/learning-help", {
        context: helpContext(page, actions), message: text, history: previous,
      }, request.signal);
      if (!request.signal.aborted) setMessages(items => [...items, { role: "assistant", text: result.reply.text }]);
    } catch (failure) {
      if (!request.signal.aborted) { setError(failure instanceof Error ? failure.message : "The reply could not load."); setDraft(text); }
    } finally { if (!request.signal.aborted) setBusy(false); }
  }
  if (!["/", "/sentences", "/listening", "/practice", "/reviews", "/vocabulary", "/progress"].includes(page.page)) return null;
  return <aside className={styles.chatDock} aria-label="Learning companion">
    {open && <section className={styles.chatPanel} id="learning-chat" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      <header className={styles.chatHeading}><div><strong>Your learning companion</strong><span>{page.revealed ? "Exploring the revealed answer" : "Hints while you practice"}</span></div>
        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close learning chat">×</button></header>
      <div className={styles.contextLabel}>About this {page.mode.replaceAll("-", " ")}{page.exercise_id ? " · current exercise" : " page"}</div>
      <div ref={list} className={styles.messages} role="log" aria-live="polite" aria-label="Learning conversation">
        <p className={styles.welcome}>Ask about what you’re learning. I can help with grammar, meaning, and pronunciation{page.revealed ? "." : " without giving away the answer."}</p>
        {messages.map((item, index) => <p key={index} className={item.role === "user" ? styles.userMessage : styles.assistantMessage}><span className={styles.srOnly}>{item.role === "user" ? "You: " : "Companion: "}</span>{item.text}</p>)}
        {busy && <p className={styles.assistantMessage}>Thinking…</p>}
      </div>
      {state !== "signed-in" ? <p className={styles.signIn}><Link href="/login">Sign in to chat</Link></p> : <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
        {error && <p role="alert">{error}</p>}
        <label className={styles.srOnly} htmlFor="learning-question">Ask about your practice</label>
        <textarea ref={input} id="learning-question" value={draft} maxLength={2000} rows={2} placeholder="Ask about your practice…" onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
        <button type="submit" disabled={busy || !draft.trim()}>{busy ? "Asking…" : "Send ↑"}</button>
      </form>}
      <small className={styles.aiNote}>AI learning help · check unfamiliar explanations.</small>
    </section>}
    <button type="button" className={styles.launcher} aria-expanded={open} aria-controls="learning-chat" onClick={() => setOpen(!open)}>
      <span aria-hidden="true">✧</span> {open ? "Close companion" : "Ask about your practice"}
    </button>
  </aside>;
}
