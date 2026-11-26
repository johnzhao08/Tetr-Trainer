import { useEffect, useState } from "react";
import { nextRefreshDelay } from "../core/review";
import type { ReviewItem } from "../core/review";

/** The current time, refreshed at the next due time and when the tab returns. */
export function useNow(items: ReviewItem[]): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  // Items replaced (e.g. by a backup import) make the stored `now` stale.
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [items]);
  useEffect(() => {
    const delay = nextRefreshDelay(items, now, Date.now());
    if (delay === null) return;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [items, now]);
  return now;
}
