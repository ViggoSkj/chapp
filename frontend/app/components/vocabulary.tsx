"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { vocabularyContext, type VocabularyPage } from "../lib/vocabulary";
import { useAccount } from "./account";
import { ExploreText, useLearningPage } from "./learning-support";
import { Icon } from "./icons";
import styles from "./vocabulary.module.css";

export function Vocabulary() {
  const { state, learner, refresh, refreshSource } = useAccount();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState({ search: "", offset: 0, revision: 0 });
  const [result, setResult] = useState<{ key: string; page?: VocabularyPage; error?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const owner = learner?.chapp_user_id;
  const key = JSON.stringify([owner, query]);
  const current = state === "signed-in" && result?.key === key ? result : null;
  const page = current?.page;
  const loading = state === "loading" || state === "signed-in" && !current;

  useEffect(() => {
    if (state !== "signed-in" || !owner) return;
    let active = true;
    const parameters = new URLSearchParams({ search: query.search, offset: String(query.offset), limit: "10" });
    api<VocabularyPage>(`/vocabulary?${parameters}`).then(page => {
      if (active) setResult({ key, page });
    }).catch(error => {
      if (active) setResult({ key, error: error instanceof Error ? error.message : "Could not read your vocabulary." });
    });
    return () => { active = false; };
  }, [state, owner, query, key]);

  useLearningPage({ key: `vocabulary:${key}:${page?.read_at ?? "loading"}`, page: "/vocabulary", mode: "reviewed-vocabulary",
    revealed: Boolean(page), content: page ? vocabularyContext(page.entries) : [] });

  async function refreshVocabulary() {
    setRefreshing(true); setRefreshError("");
    try {
      const source = await refreshSource();
      if (source.source_state !== "ready") throw new Error("Anki could not refresh. Any displayed vocabulary is from the last successful read.");
      setQuery(value => ({ ...value, offset: 0, revision: value.revision + 1 }));
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Could not refresh Anki.");
    } finally { setRefreshing(false); }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">YOUR REVIEWED ANKI VOCABULARY</div><h1>Your vocabulary.</h1><p>The expressions available for sentence practice, read from your connected Anki collection.</p></div>
      <Link href="/sentences" className="button primary">Practice sentences<Icon name="arrow" size={17} /></Link></div>
    {state === "signed-out" ? <section className="panel detail-panel"><h2>Bring your vocabulary into view.</h2><p>Sign in to browse the reviewed expressions from your connected Anki source.</p><Link href="/login" className="button primary">Sign in to view vocabulary</Link></section>
      : state === "unlinked" ? <section className="panel detail-panel"><h2>Link your learner account</h2><p>Ask your administrator to link your login before accessing the configured vocabulary source.</p><Link href="/connections" className="button secondary">Account details</Link></section>
      : state === "unavailable" ? <section className="panel detail-panel"><p role="alert">Your account could not be checked.</p><button className="button secondary" onClick={() => void refresh()}>Check account again</button></section>
      : <section className={`panel detail-panel ${styles.panel}`} aria-label="Reviewed vocabulary">
        {state === "signed-in" && <div className={styles.toolbar}>
          <form className={styles.search} onSubmit={event => { event.preventDefault(); setQuery(value => ({ search: draft.trim(), offset: 0, revision: value.revision + 1 })); }}>
            <label className="search-input"><Icon name="search" size={17} /><input aria-label="Search reviewed expressions" placeholder="Search Chinese expressions…" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} /></label>
            <button className="button secondary" type="submit">Search</button>
          </form>
          <button className="button secondary" disabled={refreshing} onClick={() => void refreshVocabulary()}>{refreshing ? "Refreshing Anki…" : "Refresh from Anki"}</button>
        </div>}
        {refreshError && <p className={styles.notice} role="alert">{refreshError}</p>}
        {loading ? <p role="status">Loading reviewed vocabulary…</p>
          : current?.error ? <div><h2>Vocabulary is unavailable</h2><p role="alert">{current.error}</p><button className="button secondary" onClick={() => setQuery(value => ({ ...value, revision: value.revision + 1 }))}>Retry vocabulary</button><Link href="/connections" className="text-link">Check connections</Link></div>
          : page ? <>
            <div className={styles.summary}><div><strong>{page.total_expressions.toLocaleString("en")}</strong><span>reviewed expressions</span></div><div><strong>{page.total_characters.toLocaleString("en")}</strong><span>eligible Chinese characters</span></div></div>
            <p className={styles.note}>Includes cards that have passed a review and are outside learning or relearning steps. This is your practice vocabulary, not a claim of mastery. Click a character for an AI explanation and pronunciation.</p>
            {!page.entries.length ? <div className={styles.empty}><h2>{page.total_expressions === 0 ? "No reviewed expressions yet." : "No expressions match."}</h2><p>{page.total_expressions === 0 ? "Review cards in your configured Anki decks, then refresh here." : "Try a different Chinese expression or clear your search."}</p></div>
              : <div className="table-scroll"><table className={styles.table}><caption className="sr-only">Reviewed expressions from the current Anki source</caption><thead><tr><th scope="col">Expression</th><th scope="col">Chinese characters</th></tr></thead><tbody>{page.entries.map(entry => <tr key={entry.text}><td lang="zh-Hans"><ExploreText text={entry.text} enabled /></td><td>{entry.character_count}</td></tr>)}</tbody></table></div>}
            <div className={styles.pagination} aria-label="Vocabulary pages"><span>{page.filtered_count ? `${page.offset + 1}–${Math.min(page.offset + page.entries.length, page.filtered_count)} of ${page.filtered_count}` : "0 expressions"}</span><div>
              <button className="button secondary" disabled={page.offset === 0} onClick={() => setQuery(value => ({ ...value, offset: Math.max(0, value.offset - 10) }))}>Previous expressions</button>
              <button className="button secondary" disabled={page.offset + page.limit >= page.filtered_count} onClick={() => setQuery(value => ({ ...value, offset: value.offset + 10 }))}>More expressions</button>
            </div></div>
            <p className={styles.note}>Last source read: {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(page.read_at))} UTC. Search and page changes use this in-memory snapshot; refresh reads Anki again. Anki cards are never modified.</p>
          </> : null}
      </section>}
  </>;
}
