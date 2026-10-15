"use client";
// Runs the simulated daily price check for the watchlist (on load and every
// 5 minutes while the app is open) and shows in-app alerts when a fare drops
// below the user's target.
import Link from "next/link";
import { useEffect, useRef } from "react";
import { BellRing, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { applyTrackResults, dismissAlert, useAlerts, useWatchlist, type WatchItem } from "@/lib/storage";
import { todayISO } from "@/lib/sim/dates";

export async function checkWatchlist(items: WatchItem[]) {
  if (!items.length) return [];
  const res = await fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map(({ id, from, to, date, cabin, target }) => ({ id, from, to, date, cabin, target })) }),
  });
  if (!res.ok) throw new Error("track failed");
  const data = (await res.json()) as { results: Array<{ id: string; current: number | null; belowTarget?: boolean; history?: Array<{ date: string; price: number }>; low30?: number | null; previous?: number | null; departed?: boolean }> };
  applyTrackResults(data.results, todayISO());
  return data.results;
}

export function AlertCenter() {
  const { t, formatPrice, formatDate, city } = useI18n();
  const [watchlist] = useWatchlist();
  const [alerts] = useAlerts();
  const lastRun = useRef(0);
  const ids = watchlist.map((w) => `${w.id}:${w.target}`).join("|");

  useEffect(() => {
    if (!watchlist.length) return;
    const run = () => {
      lastRun.current = Date.now();
      checkWatchlist(watchlist).catch(() => {});
    };
    if (Date.now() - lastRun.current > 30_000) run();
    const iv = setInterval(run, 5 * 60_000);
    return () => clearInterval(iv);
    // Re-run when the set of watched routes or targets changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const visible = alerts.filter((a) => !a.dismissed).slice(0, 3);
  if (!visible.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
      {visible.map((a) => (
        <div
          key={a.id}
          role="alert"
          data-testid="price-alert"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl shadow-emerald-900/10 dark:border-emerald-900 dark:bg-slate-900"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <BellRing className="h-5 w-5 animate-float" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">{t("watch.alert.title")}</p>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
              {t("watch.alert.body", { from: city(a.from), to: city(a.to), date: formatDate(a.date), price: formatPrice(a.price), target: formatPrice(a.target) })}
            </p>
            <Link
              href={`/results?from=${a.from}&to=${a.to}&date=${a.date}&pax=1&cabin=economy`}
              onClick={() => dismissAlert(a.id)}
              className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300"
            >
              {t("watch.searchNow")} →
            </Link>
          </div>
          <button type="button" onClick={() => dismissAlert(a.id)} className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label={t("common.dismiss")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
