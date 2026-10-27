"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "./account";
import { api } from "../lib/api";

export function Connections() {
  const { state, source, refresh, refreshSource } = useAccount();
  const [backend, setBackend] = useState("Checking…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ service: string; status: string }>("/status").then(result => { if (active) setBackend(result.status === "ok" ? "Available" : "Unavailable"); }).catch(() => { if (active) setBackend("Unavailable"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (state !== "signed-in" || source) return;
    let active = true;
    refreshSource().catch(() => { if (active) setError("Could not refresh your vocabulary. Please try again."); });
    return () => { active = false; };
  }, [state, source, refreshSource]);
  return <>
    <div className="page-heading"><div><div className="eyebrow">YOUR LEARNING SPACE</div><h1>Your connections.</h1><p>Check your account and refresh the vocabulary used in sentence practice.</p></div></div>
    <div className="connections-grid">
      <section className="panel detail-panel"><h2>Your account</h2>
        <p className="connection-state">{state === "signed-in" ? "Signed in · learner account linked" : state === "unlinked" ? "Signed in · learner account needs linking" : state === "signed-out" ? "Sign in to access your learning" : state === "loading" ? "Checking account…" : "Account service unavailable"}</p>
        {state === "signed-out" ? <Link className="button primary" href="/login">Sign in</Link> : state === "unlinked" ? <p>Ask the administrator to link your Neuron login to a learner account.</p> : state === "unavailable" ? <button className="button secondary" onClick={() => void refresh()}>Check again</button> : null}
        <dl className="connection-details"><dt>Learning service</dt><dd>{backend}</dd><dt>Account data</dt><dd>Your saved exercises and answers stay with your login.</dd></dl>
      </section>
      <section className="panel detail-panel"><h2>Anki vocabulary</h2>
        <p className="connection-state">{state !== "signed-in" ? "Sign in to check your vocabulary source" : !source ? "Checking vocabulary…" : source.source_state === "ready" ? "Connected · vocabulary refreshed" : "Vocabulary refresh unavailable"}</p>
        <p>Sentence practice uses characters from your encountered Anki vocabulary. This connection reads your cards without changing them.</p>
        <div className="account-actions"><button className="button secondary" disabled={state !== "signed-in" || busy} onClick={async () => {
          setBusy(true); setError("");
          try { const result = await refreshSource(); if (result.source_state !== "ready") setError("Anki could not refresh right now. Please try again."); }
          catch { setError("Could not refresh your vocabulary. Please try again."); }
          finally { setBusy(false); }
        }}>{busy ? "Refreshing…" : "Refresh vocabulary"}</button><Link className="button primary" href={state === "signed-in" ? "/sentences" : "/login"}>Sentence practice</Link></div>
        {error && <p className="account-error" role="alert">{error}</p>}
      </section>
    </div>
    <p className="login-note">Vocabulary, reviews, and progress pages still contain labelled example data. Sentence practice and saved attempts use your account.</p>
  </>;
}
