"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../lib/api";

type Learner = { chapp_user_id: string };
type Source = { chapp_user_id: string; source_state: string; source_error: string | null };
type AccountState = "loading" | "signed-out" | "signed-in" | "unlinked" | "unavailable";
const AccountContext = createContext<{
  state: AccountState; learner: Learner | null; source: Source | null;
  refresh: () => Promise<void>; refreshSource: () => Promise<Source>; signOut: () => Promise<void>;
} | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountState>("loading");
  const [learner, setLearner] = useState<Learner | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const refresh = useCallback(async () => {
    try {
      const current = await api<Learner>("/me");
      setLearner(current); setState("signed-in");
    } catch (error) {
      setLearner(null); setSource(null);
      setState(error instanceof ApiError && error.status === 401 ? "signed-out" : error instanceof ApiError && error.status === 403 ? "unlinked" : "unavailable");
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Learner>("/me").then(current => {
      if (active) { setLearner(current); setState("signed-in"); }
    }).catch(error => {
      if (!active) return;
      setState(error instanceof ApiError && error.status === 401 ? "signed-out" : error instanceof ApiError && error.status === 403 ? "unlinked" : "unavailable");
    });
    return () => { active = false; };
  }, []);
  const refreshSource = useCallback(async () => {
    const result = await api<Source>("/login-completions", {}); setSource(result); return result;
  }, []);
  async function signOut() {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "X-Chapp-Request": "1" } });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    setLearner(null); setSource(null); setState("signed-out");
  }
  return <AccountContext.Provider value={{ state, learner, source, refresh, refreshSource, signOut }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error("AccountProvider is missing.");
  return account;
}

export function AccountMenu() {
  const { state, signOut } = useAccount();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="account-menu">
    {state === "signed-in" || state === "unlinked" ? <>
      <Link href="/connections" className="account-label">{state === "signed-in" ? "Signed in" : "Account needs linking"}</Link>
      <button className="button secondary" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await signOut(); router.push("/login"); router.refresh(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Could not sign out."); }
        finally { setBusy(false); }
      }}>{busy ? "Signing out…" : "Sign out"}</button>
    </> : <Link href="/login" className="button secondary">{state === "loading" ? "Checking account…" : "Sign in"}</Link>}
    {error && <span role="alert">{error}</span>}
  </div>;
}

export function LoginForm() {
  const { state, refresh, refreshSource } = useAccount();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="panel login-panel">
    <div className="eyebrow">YOUR MANDARIN WORKSPACE</div>
    <h1>Welcome back.</h1>
    <p>Sign in with your Neuron username and password.</p>
    {state === "signed-in" ? <div className="account-actions"><p>You’re already signed in.</p><Link className="button primary" href="/sentences">Go to sentence practice</Link></div> : <form className="login-form" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      const form = event.currentTarget;
      const data = new FormData(form);
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Chapp-Request": "1" },
          body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not sign in.");
        form.reset(); await refresh();
        try { await refreshSource(); } catch { /* Connections shows account and source state separately. */ }
        router.push("/connections"); router.refresh();
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not sign in."); }
      finally { setBusy(false); }
    }}>
      <label>Username<input name="username" autoComplete="username" required maxLength={320} autoCapitalize="none" spellCheck={false} disabled={busy} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={4096} disabled={busy} /></label>
      {error && <p role="alert" className="account-error">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>}
    <p className="login-note">Use your existing login. Creating a new learner account is handled by the administrator.</p>
  </section>;
}
