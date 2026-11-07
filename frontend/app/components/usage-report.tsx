"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAccount } from "./account";
import styles from "./usage-report.module.css";

type Bucket = {
  kind: string; name: string; page: string; layout: string; viewport: string;
  count: number; errors: number; average: number; p95: number;
};
type Report = {
  since: string; through: string; retention_days: number; sessions: number;
  dropped_events: number; persistence_failures: number; buckets: Bucket[];
};
const amount = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function UsageReport() {
  const { state, learner } = useAccount();
  const [days, setDays] = useState(7);
  const [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<{ owner: string; data: Report } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (state !== "signed-in" || !learner) return;
    const owner = learner.chapp_user_id;
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const next = await api<Report>("/admin/usage?days=" + days);
        if (active) setReport({ owner, data: next });
      } catch (failure) {
        if (active) {
          setReport(null);
          setError(failure instanceof ApiError && failure.status === 403
            ? "Usage reports require your Chapp administrator account."
            : failure instanceof Error ? failure.message : "Usage could not load.");
        }
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [state, learner, days, refresh]);

  const visible = state === "signed-in" && report?.owner === learner?.chapp_user_id ? report?.data ?? null : null;
  const buckets = visible?.buckets ?? [];
  const count = (kind: string, name?: string) => buckets.filter(row =>
    row.kind === kind && (!name || row.name === name)).reduce((total, row) => total + row.count, 0);
  const requests = buckets.filter(row => row.kind === "request");
  const errors = requests.reduce((total, row) => total + row.errors, 0);
  function exportReport() {
    if (!visible) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(visible, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "chapp-usage-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return <div className={styles.report}>
    <div className="page-heading"><div><div className="eyebrow">APP USAGE</div><h1>Where practice flows.</h1>
      <p>See which pages and layouts you use, how plans progress, and where requests slow down.</p></div></div>
    {state !== "signed-in" && <p role="status">{state === "loading" ? "Checking your account…" : "Sign in with your Chapp administrator account to view usage."}</p>}
    {state === "signed-in" && <div className={styles.controls}>
      <label>Reporting window<select value={days} disabled={loading} onChange={event => setDays(Number(event.target.value))}>
        <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
      </select></label>
      <button className="button secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? "Loading…" : "Refresh"}</button>
      <button className="button secondary" disabled={!visible || loading} onClick={exportReport}>Export JSON</button>
    </div>}
    {error && <p role="alert">{error}</p>}
    {visible && <>
      <p className={styles.note}>UTC window from {new Date(visible.since).toLocaleString()} to {new Date(visible.through).toLocaleString()}. Measurements are retained for {visible.retention_days} days.</p>
      <div className={styles.cards}>
        {[["Page views", count("page")], ["Tab sessions", visible.sessions], ["Plans created", count("action", "plan-created")],
          ["Plans finished", count("action", "plan-completed")], ["API requests", count("request")], ["API errors", errors]].map(([label, value]) =>
          <div className="panel" key={label}><span>{label}</span><strong>{amount(Number(value))}</strong></div>)}
      </div>
      {!buckets.length && <p role="status">No measurements have been saved in this window yet. Use the site, then refresh this report.</p>}
      <section className="panel"><h2>API requests</h2><p>Handler duration includes generation and provider waits. Health checks and usage reporting are excluded.</p>
        <div className={styles.table}><table><thead><tr><th>Route</th><th>Requests</th><th>Errors</th><th>Average</th><th>95th percentile</th></tr></thead>
          <tbody>{requests.map(row => <tr key={row.name}><td>{row.name}</td><td>{amount(row.count)}</td><td>{amount(row.errors)}</td><td>{amount(row.average)} ms</td><td>{amount(row.p95)} ms</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel"><h2>Pages, actions and layouts</h2><p>Compare layout choices and completed plans as usage accumulates.</p>
        <div className={styles.table}><table><thead><tr><th>Page</th><th>Event</th><th>Layout</th><th>Screen</th><th>Count</th></tr></thead>
          <tbody>{buckets.filter(row => row.kind === "page" || row.kind === "action").map(row =>
            <tr key={[row.kind, row.name, row.page, row.layout, row.viewport].join("|")}><td>{row.page}</td><td>{row.name}</td><td>{row.layout || "—"}</td><td>{row.viewport}</td><td>{amount(row.count)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel"><h2>Browser performance</h2><p>LCP measures main-content display time, INP interaction delay, CLS visual shifts, and TTFB the initial server wait. Unsupported measurements remain absent.</p>
        <div className={styles.table}><table><thead><tr><th>Page</th><th>Metric</th><th>Layout / screen</th><th>Samples</th><th>Average</th><th>95th percentile</th></tr></thead>
          <tbody>{buckets.filter(row => row.kind === "vital").map(row => <tr key={[row.name,row.page,row.layout,row.viewport].join("|")}>
            <td>{row.page}</td><td>{row.name}</td><td>{row.layout} / {row.viewport}</td><td>{amount(row.count)}</td>
            <td>{row.average.toFixed(row.name === "CLS" ? 3 : 0)}{row.name === "CLS" ? "" : " ms"}</td>
            <td>{row.p95.toFixed(row.name === "CLS" ? 3 : 0)}{row.name === "CLS" ? "" : " ms"}</td></tr>)}</tbody></table></div>
      </section>
      <p className={styles.note}>Browser counts can be affected by closed tabs, blocked requests or connection loss. Sessions identify a tab, not a person.</p>
      {(visible.dropped_events > 0 || visible.persistence_failures > 0) && <p role="status">
        Recorder health since restart. {visible.dropped_events} dropped events and {visible.persistence_failures} persistence retries.
      </p>}
    </>}
  </div>;
}
