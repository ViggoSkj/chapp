"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { PracticeProgress } from "../lib/progress";
import styles from "./study-goals.module.css";
type Goals = { weekly_days: number; weekly_attempts: number; updated_at: string };
export function StudyGoals({ progress }: { progress: PracticeProgress }) {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [days, setDays] = useState("4");
  const [attempts, setAttempts] = useState("20");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;

    api<Goals | null>("/goals").then(value => {
      if (!active) return;
      setGoals(value);
      if (value) { setDays(String(value.weekly_days)); setAttempts(String(value.weekly_attempts)); }
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "Could not load goals."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const today = new Date(progress.as_of);
  const weekday = (today.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - weekday));
  const date = (offset: number) => new Date(monday.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const current = progress.activity.filter(day => day.date >= date(0));
  const previous = progress.activity.filter(day => day.date >= date(-7) && day.date <= date(weekday - 7));
  const total = current.reduce((sum, day) => sum + day.attempts, 0);
  const activeDays = current.filter(day => day.attempts > 0).length;
  const priorTotal = previous.reduce((sum, day) => sum + day.attempts, 0);
  const graded = current.reduce((sum, day) => sum + day.graded_attempts, 0);
  const correct = current.reduce((sum, day) => sum + day.fully_correct_attempts, 0);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setStatus("");
    try {
      const result = await api<Goals>("/goals", { weekly_days: Number(days), weekly_attempts: Number(attempts) });
      setGoals(result); setEditing(false); setStatus("Your weekly goals are saved.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save goals."); }
    finally { setBusy(false); }
  }
  return <section className={`panel ${styles.panel}`} aria-label="Weekly goals">
    <div className={styles.heading}><div><div className="eyebrow">TURN PRACTICE INTO A HABIT</div><h2>Your week, your goals.</h2><p>Monday–Sunday · UTC · {date(0)} to {date(6)}</p></div>{goals && !editing && <button className="button secondary" onClick={() => { setEditing(true); setStatus(""); }}>Edit weekly goals</button>}</div>
    {loading ? <p role="status">Loading your goals…</p> : <>
      {error && <div role="alert"><p>{error}</p>{!editing && <button className="button secondary" onClick={() => { setLoading(true); setError(""); setRevision(value => value + 1); }}>Reload goals</button>}</div>}
      {!error && !goals && !editing && <div className={styles.unset}><p>Choose how often you want to practice and how many answers you want to submit. You can adjust your targets as you learn.</p><button className="button primary" onClick={() => setEditing(true)}>Set weekly goals</button></div>}
      {editing && <form onSubmit={save} className={styles.form}><label>Practice days per week<input type="number" min="1" max="7" step="1" required value={days} disabled={busy} onChange={event => setDays(event.target.value)} /></label><label>Submitted answers per week<input type="number" min="1" max="1000" step="1" required value={attempts} disabled={busy} onChange={event => setAttempts(event.target.value)} /></label><div><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save weekly goals"}</button><button type="button" className="button secondary" disabled={busy} onClick={() => { setEditing(false); if (goals) { setDays(String(goals.weekly_days)); setAttempts(String(goals.weekly_attempts)); } }}>Cancel</button></div><p>These targets measure saved Chapp practice. A submitted “Don’t know” counts as an attempt. Targets apply to the current week, including earlier activity.</p></form>}
      {goals && <div className={styles.targets}>{[{label:"Practice days",value:activeDays,target:goals.weekly_days,unit:"days"},{label:"Submitted answers",value:total,target:goals.weekly_attempts,unit:"answers"}].map(item => <div key={item.label}><span>{item.label}</span><h3>{item.value}<small> / {item.target} {item.unit}</small></h3><progress value={Math.min(item.value,item.target)} max={item.target} aria-label={item.label} /><p>{item.value >= item.target ? "Weekly target reached ✓" : `${item.target-item.value} more ${item.unit} to reach your target`}</p></div>)}</div>}
      <div className={styles.review}><div><h3>This week so far</h3><p><strong>{total}</strong> answers across <strong>{activeDays}</strong> practice days.</p><p>{total === priorTotal ? "The same number of submissions" : `${Math.abs(total-priorTotal)} ${total>priorTotal ? "more" : "fewer"} submissions`} than the same weekdays last week ({priorTotal}).</p></div><div><h3>Learning evidence</h3><p>{graded ? `${Math.round(correct/graded*100)}% fully correct · ${graded} graded answers` : "No completed grades this week yet."}</p><p>{total-graded} ungraded · {progress.questions_needing_practice} questions to revisit now.</p></div></div>
      <p className={styles.note}>This is practice consistency, not a measure of fluency or vocabulary mastery. Latest valid grades are grouped by submission day; ungraded answers never count as incorrect.</p>
    </>}
    <p role="status">{status}</p>
  </section>;
}