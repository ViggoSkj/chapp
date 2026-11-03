"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { PracticeProgress } from "../lib/progress";
import { useAccount } from "./account";
import { Icon } from "./icons";
import styles from "./progress.module.css";

function dayLabel(date: string, short = false) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC", month: short ? undefined : "short", day: "numeric",
    weekday: short ? "short" : undefined,
  }).format(new Date(`${date}T00:00:00Z`));
}

function Activity({ progress }: { progress: PracticeProgress }) {
  const [range, setRange] = useState(7);
  const days = progress.activity.slice(-range);
  const maximum = Math.max(1, ...days.map(day => day.attempts));
  const total = days.reduce((sum, day) => sum + day.attempts, 0);
  return <section className={`panel ${styles.activity}`} aria-label="Practice activity">
    <div className="panel-heading">
      <div><h2>Practice activity</h2><p>Original answers submitted each day · UTC</p></div>
      <label className="select-wrap"><span className="sr-only">Activity period</span>
        <select value={range} onChange={event => setRange(Number(event.target.value))}>
          <option value={7}>Last 7 days</option><option value={28}>Last 28 days</option>
        </select>
      </label>
    </div>
    <div className={styles.plot} role="img" aria-label={`${total} submitted attempts in the last ${range} days. ${days.map(day => `${day.date}: ${day.attempts}`).join(", ")}`}>
      <div className={styles.scale} aria-hidden="true"><span>{maximum}</span><span>{Math.floor(maximum / 2)}</span><span>0</span></div>
      <div className={styles.bars} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {days.map((day, index) => <div className={styles.column} key={day.date}>
          <div className={styles.track} title={`${dayLabel(day.date)}: ${day.attempts} attempts`}>
            <div className={styles.bar} style={{ height: `${day.attempts / maximum * 100}%` }} />
          </div>
          <span>{range === 7 ? dayLabel(day.date, true).split(" ")[0] : index % 4 === 0 || index === days.length - 1 ? Number(day.date.slice(-2)) : ""}</span>
        </div>)}
      </div>
    </div>
    <div className="chart-footer"><span>Submitted attempts</span><span><strong>{total.toLocaleString("en")}</strong> in {range} days</span></div>
    <details className={styles.details}><summary>View daily counts</summary>
      <div className="table-scroll"><table><caption className="sr-only">Daily submission and grade counts in UTC</caption>
        <thead><tr><th scope="col">Date (UTC)</th><th scope="col">Attempts</th><th scope="col">Graded</th><th scope="col">Fully correct</th></tr></thead>
        <tbody>{days.map(day => <tr key={day.date}><th scope="row">{dayLabel(day.date)}</th><td>{day.attempts}</td><td>{day.graded_attempts}</td><td>{day.fully_correct_attempts}</td></tr>)}</tbody>
      </table></div>
    </details>
  </section>;
}

function Summary({ progress }: { progress: PracticeProgress }) {
  const score = progress.average_correctness === null ? "—" : `${Math.round(progress.average_correctness * 100)}%`;
  const stats = [
    { label: "Submitted attempts", value: progress.total_attempts.toLocaleString("en"), note: `${progress.graded_attempts.toLocaleString("en")} graded · all time`, icon: "book", color: "sage" },
    { label: "Average score", value: score, note: progress.graded_attempts ? `${progress.fully_correct_attempts.toLocaleString("en")} fully correct attempts` : "No graded attempts yet", icon: "spark", color: "lavender" },
    { label: "Questions to revisit", value: progress.questions_needing_practice.toLocaleString("en"), note: "Based on each question’s latest grade", icon: "cards", color: "peach" },
    { label: "Current streak", value: `${progress.current_streak_days}`, suffix: "days", note: `Best: ${progress.best_streak_days} days · UTC`, icon: "flame", color: "butter" },
  ];
  return <div className="stats-grid">{stats.map(stat => <div className="stat-card" key={stat.label}>
    <div className="stat-top"><span>{stat.label}</span><span className={`stat-icon ${stat.color}`}><Icon name={stat.icon} size={18} /></span></div>
    <div className="stat-value">{stat.value}<span>{stat.suffix}</span></div><div className="stat-note">{stat.note}</div>
  </div>)}</div>;
}

export function ProgressDashboard({ overview = false }: { overview?: boolean }) {
  const { state, learner, refresh } = useAccount();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; progress?: PracticeProgress; error?: string; signIn?: boolean } | null>(null);
  const owner = learner?.chapp_user_id;
  const key = `${owner}:${revision}`;
  useEffect(() => {
    if (state !== "signed-in" || !owner) return;
    let active = true;
    api<PracticeProgress>("/progress").then(progress => {
      if (active) setResult({ key, progress });
    }).catch(error => {
      if (active) setResult({ key, error: error instanceof Error ? error.message : "Could not load your progress.", signIn: error instanceof ApiError && error.status === 401 });
    });
    return () => { active = false; };
  }, [state, owner, key]);
  const current = state === "signed-in" && result?.key === key ? result : null;
  const progress = current?.progress;
  const loading = state === "loading" || state === "signed-in" && !current;
  return <>
    <div className="page-heading"><div><div className="eyebrow">YOUR MANDARIN JOURNEY</div>
      <h1>{overview ? "A little better, every day." : "Your progress."}</h1>
      <p>Your saved sentence practice, one step at a time.</p></div>
      <Link href="/practice" className="button primary"><Icon name="spark" size={17} />Let’s practice<Icon name="arrow" size={17} /></Link>
    </div>
    {loading ? <section className="panel detail-panel" role="status">Loading your progress…</section>
      : state === "signed-out" ? <section className="panel detail-panel"><h2>Your journey starts here.</h2><p>Sign in to see your saved practice and progress.</p><Link className="button primary" href="/login">Sign in to view progress</Link></section>
      : state === "unlinked" ? <section className="panel detail-panel"><h2>Link your learner account</h2><p>Your login needs a learner account before saved progress is available. Ask your administrator to link it.</p><Link href="/connections" className="button secondary">Account details</Link></section>
      : state === "unavailable" ? <section className="panel detail-panel"><p role="alert">Your account could not be checked. Try again to load your progress.</p><button className="button secondary" onClick={() => void refresh()}>Check account again</button></section>
      : current?.error ? <section className="panel detail-panel"><h2>Progress is unavailable</h2><p role="alert">{current.error}</p><button className="button secondary" onClick={() => setRevision(value => value + 1)}>Retry progress</button>{current.signIn && <Link className="button primary" href="/login">Sign in</Link>}</section>
      : progress ? <>
        <div className={styles.toolbar}><span>Saved practice · all-time totals</span><button className="button secondary" onClick={() => setRevision(value => value + 1)}>Refresh progress</button></div>
        <Summary progress={progress} />
        {progress.total_attempts === 0 && <section className={`panel detail-panel ${styles.notice}`}><h2>Your first small step.</h2><p>No saved attempts yet. Submit a sentence answer to start building your practice history.</p><Link className="button primary" href="/sentences">Start sentence practice</Link></section>}
        {progress.ungraded_attempts > 0 && <p className={styles.notice} role="note">{progress.ungraded_attempts} {progress.ungraded_attempts === 1 ? "attempt has" : "attempts have"} no completed grade. Pending or failed grading does not lower your average score.</p>}
        <div className={styles.insights}><Activity progress={progress} /><section className={`panel ${styles.next}`}>
          <div className="eyebrow">YOUR NEXT SMALL STEP</div><h2>{progress.questions_needing_practice > 0 ? "Give it another try." : "Keep your practice growing."}</h2>
          <p>{progress.questions_needing_practice > 0 ? `${progress.questions_needing_practice} ${progress.questions_needing_practice === 1 ? "question is" : "questions are"} ready to revisit. A fully correct answer clears a question from your queue.` : "Try a new sentence using characters from your Anki vocabulary."}</p>
          <Link className="button primary" href={progress.questions_needing_practice > 0 ? "/practice" : "/sentences"}>{progress.questions_needing_practice > 0 ? "Revisit questions" : "Practice a new sentence"}<Icon name="arrow" size={16} /></Link>
          <p className={styles.explanation}>Each submitted answer counts once. Assessment retries update its grade. Scores average the latest valid grade for each answer.</p>
        </section></div>
        <p className={styles.explanation}>Activity and streaks use UTC calendar days. A streak continues through yesterday if you have not practiced today. Grades are grouped by the original submission day. These figures cover saved practice in your current learner account.</p>
        <p className={styles.updated}>Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(progress.as_of))} UTC</p>
      </> : null}
    {overview && <section className={`panel detail-panel ${styles.toolkit}`}><h2>Your learning toolkit</h2><div>
      <Link className="button secondary" href="/sentences">Sentence practice</Link><Link className="button secondary" href="/practice">Daily practice</Link><Link className="button secondary" href="/progress">Your progress</Link><Link className="button secondary" href="/vocabulary">Your vocabulary</Link><Link className="button secondary" href="/connections">Connections</Link>
    </div><p>Train your ear with <Link href="/listening">Listening practice</Link>, or explore <Link href="/reviews">Anki reviews</Link> · Anki reviews currently show demo content.</p></section>}
  </>;
}
