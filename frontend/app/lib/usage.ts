import { requestId } from "./api";

let enabled = false;
let session: string | null = null;
let lastPage = "";
const pages = new Set(["/", "/practice", "/sentences", "/listening", "/vocabulary", "/progress", "/connections", "/reviews", "/usage"]);

export function enableUsage(value: boolean) {
  enabled = value;
  if (!value) {
    session = null;
    lastPage = "";
    try { sessionStorage.removeItem("chapp.usage-session"); } catch {}
  }
}

function tabSession() {
  if (session) return session;
  try {
    session = sessionStorage.getItem("chapp.usage-session");
    if (!session || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(session)) {
      session = requestId();
      sessionStorage.setItem("chapp.usage-session", session);
    }
  } catch { session = requestId(); }
  return session;
}

export function trackUsage(kind: "page" | "action" | "vital", name: string, value = 0,
  options?: { layout?: string; page?: string }) {
  if (!enabled || !Number.isFinite(value)) return;
  const page = options?.page ?? window.location.pathname;
  if (!pages.has(page)) return;
  if (kind === "page") {
    if (lastPage === page) return;
    lastPage = page;
  }
  const selected = options?.layout ?? document.querySelector<HTMLElement>("[data-exercise-layout]")?.dataset.exerciseLayout ?? "";
  const body = {
    id: requestId(), session: tabSession(), kind, name, page,
    layout: selected,
    viewport: innerWidth < 600 ? "small" : innerWidth < 1100 ? "medium" : "large",
    value: Math.min(86_400_000, Math.max(0, Math.round(value))),
  };
  void fetch("/chapbackend-api/usage/events", {
    method: "POST", credentials: "same-origin", keepalive: true,
    headers: { "Content-Type": "application/json", "X-Chapp-Request": "1" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
