"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useAccount } from "./account";
import { enableUsage, trackUsage } from "../lib/usage";

export function UsageObserver() {
  const pathname = usePathname();
  const { state } = useAccount();
  const auth = useRef(state);
  const pending = useRef<{ name: string; value: number; page: string }[]>([]);
  useEffect(() => {
    auth.current = state;
    if (state === "loading") return;
    enableUsage(state === "signed-in");
    if (state === "signed-in") {
      trackUsage("page", "view");
      for (const metric of pending.current) trackUsage("vital", metric.name, metric.value, { page: metric.page });
    }
    pending.current = [];
  }, [pathname, state]);

  useEffect(() => {
    const failed = () => trackUsage("action", "client-error");
    window.addEventListener("error", failed);
    window.addEventListener("unhandledrejection", failed);
    return () => {
      window.removeEventListener("error", failed);
      window.removeEventListener("unhandledrejection", failed);
    };
  }, []);

  useReportWebVitals(useCallback(metric => {
    if (["LCP", "INP", "CLS", "FCP", "TTFB"].includes(metric.name)) {
      const page = metric.navigationURL ? new URL(metric.navigationURL, location.origin).pathname : location.pathname;
      const value = metric.name === "CLS" ? metric.value * 1_000_000 : metric.value;
      if (auth.current === "loading" && pending.current.length < 20) pending.current.push({ name: metric.name, value, page });
      else if (auth.current === "signed-in") trackUsage("vital", metric.name, value, { page });
    }
  }, []));
  return null;
}
