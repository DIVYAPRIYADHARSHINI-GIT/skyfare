"use client";
// Price tracker: add routes with a target price, see 30-day simulated price
// history and an in-app alert when the fare drops below the target.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Check, Pencil, RefreshCw, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n";
import { addDays, todayISO } from "@/lib/sim/dates";
import { addWatch, useWatchlist, type WatchItem } from "@/lib/storage";
import type { TrackResponse } from "@/lib/types";
import { checkWatchlist } from "@/components/AlertCenter";
import { PriceHistoryChart } from "@/components/charts";
import { SearchForm, type SearchValues } from "@/components/SearchForm";
import { Badge, Button, ButtonLink, Card, EmptyState, Loading, Notice, PageHeader, inputClass } from "@/components/ui";

type Result = TrackResponse["results"][number];

export function WatchlistView() {
  const { t, formatPrice, formatDate, city, info } = useI18n();
  const [list, setList] = useWatchlist();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [target, setTarget] = useState<string>("");
  const [notice, setNotice] = useState<{ tone: "success" | "warn"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = useCallback(async (items: WatchItem[]) => {
    if (!items.length) return;
    setLoading(true);
    try {
      const res = await checkWatchlist(items);
      setResults(Object.fromEntries(res.map((r) => [r.id, r as Result])));
      setCheckedAt(new Date());
    } catch {
      setNotice({ tone: "warn", text: t("common.offline") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  const key = list.map((w) => `${w.id}:${w.target}`).join("|");
  useEffect(() => {
    refresh(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const add = (v: SearchValues) => {
    const tg = Number(target);
    const r = addWatch({ from: v.from, to: v.to, date: v.date, cabin: v.cabin, target: tg > 0 ? tg : 0 });
    if (r === "added" && !(tg > 0)) {
      // Fill in a suggested target (8% under today's fare) once we know the price.
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: "x", ...v, target: 0 }] }) })
        .then((r) => r.json())
        .then((d: TrackResponse) => {
          const cur = d.results[0] && "current" in d.results[0] ? d.results[0].current : null;
          if (cur) setList((l) => l.map((w) => (w.from === v.from && w.to === v.to && w.date === v.date && w.cabin === v.cabin && !w.target ? { ...w, target: Math.round((cur * 0.92) / 50) * 50 } : w)));
        })
        .catch(() => {});
    }
    setNotice(r === "added" ? { tone: "success", text: t("watch.added", { from: city(v.from), to: city(v.to) }) } : { tone: "warn", text: r === "exists" ? t("watch.exists") : t("watch.full") });
    setTarget("");
  };

  const remove = (id: string) => setList((l) => l.filter((w) => w.id !== id));
  const saveTarget = (id: string) => {
    const v = Number(editValue);
    if (v > 0) setList((l) => l.map((w) => (w.id === id ? { ...w, target: Math.round(v) } : w)));
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t("watch.title")}
        subtitle={t("watch.subtitle")}
        icon={<Bell className="h-6 w-6" />}
        actions={
          list.length > 0 && (
            <Button variant="secondary" onClick={() => refresh(list)} disabled={loading} data-testid="check-now">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              {t("watch.checkNow")}
            </Button>
          )
        }
      />
      <Card className="mb-5 p-4">
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("watch.add")}</h2>
        <SearchForm initial={{ date: addDays(todayISO(), 45) }} onSubmit={add} submitLabel={t("watch.add")} showPax={false} autoSubmitVoice={false} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="target" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t("watch.target")}
          </label>
          <input id="target" data-testid="target-input" type="number" min={0} step={50} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="₹" className={`${inputClass} max-w-[10rem]`} />
        </div>
      </Card>
      {notice && (
        <div className="mb-4">
          <Notice tone={notice.tone} onClose={() => setNotice(null)} closeLabel={t("common.close")}>
            {notice.text}
          </Notice>
        </div>
      )}
      {checkedAt && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {t("watch.lastChecked", { time: new Intl.DateTimeFormat(info.intl, { hour: "2-digit", minute: "2-digit" }).format(checkedAt) })}
        </p>
      )}

      {!mounted ? (
        <Loading />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState title={t("watch.empty.title")} body={t("watch.empty.body")} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" data-testid="watch-list">
          {list.map((w) => {
            const r = results[w.id];
            const ok = r && !("error" in r && r.error) ? r : null;
            const current: number | null = (ok && "current" in ok ? ok.current : null) ?? w.lastPrice ?? null;
            const departed = Boolean(ok && "departed" in ok && ok.departed);
            const below = current !== null && w.target > 0 && current <= w.target;
            const prev: number | null = ok && "previous" in ok ? (ok.previous ?? null) : null;
            const change = current !== null && prev ? current - prev : 0;
            const history: Array<{ date: string; price: number }> = (ok && "history" in ok ? ok.history : undefined) ?? [];
            return (
              <li key={w.id} data-testid="watch-item">
                <Card className={`h-full p-4 ${below ? "border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-800 dark:ring-emerald-900" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {city(w.from)} → {city(w.to)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {w.from}-{w.to} · {formatDate(w.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {w.cabin === "business" ? t("search.business") : t("search.economy")}
                      </p>
                    </div>
                    {departed ? (
                      <Badge tone="slate">{t("watch.departed")}</Badge>
                    ) : below ? (
                      <Badge tone="green">
                        <BellRing className="h-3 w-3" aria-hidden="true" />
                        {t("watch.belowTarget")}
                      </Badge>
                    ) : current !== null && w.target > 0 ? (
                      <Badge tone="amber">{t("watch.aboveTarget", { amount: formatPrice(current - w.target) })}</Badge>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">{t("watch.current")}</dt>
                      <dd className="tabular font-bold text-slate-900 dark:text-white" data-testid="watch-current">
                        {current !== null ? formatPrice(current) : "-"}
                      </dd>
                      {change !== 0 && (
                        <dd className={`flex items-center gap-0.5 text-xs font-semibold ${change < 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {change < 0 ? <TrendingDown className="h-3 w-3" aria-hidden="true" /> : <TrendingUp className="h-3 w-3" aria-hidden="true" />}
                          {formatPrice(Math.abs(change))}
                        </dd>
                      )}
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">{t("watch.target")}</dt>
                      {editing === w.id ? (
                        <dd className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveTarget(w.id)}
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                            aria-label={t("watch.target")}
                          />
                          <button type="button" onClick={() => saveTarget(w.id)} className="rounded p-1 text-emerald-600" aria-label={t("watch.save")}>
                            <Check className="h-4 w-4" />
                          </button>
                        </dd>
                      ) : (
                        <dd className="flex items-center gap-1">
                          <span className="tabular font-bold text-emerald-700 dark:text-emerald-300">{w.target ? formatPrice(w.target) : "-"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(w.id);
                              setEditValue(String(w.target || ""));
                            }}
                            className="rounded p-1 text-slate-400 hover:text-brand-600"
                            aria-label={t("watch.editTarget")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </dd>
                      )}
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">{t("watch.lowest30")}</dt>
                      <dd className="tabular font-bold text-slate-900 dark:text-white">{r && "low30" in r && r.low30 ? formatPrice(r.low30) : "-"}</dd>
                    </div>
                  </dl>
                  <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("watch.history")}</p>
                  {history.length > 1 ? <PriceHistoryChart data={history} target={w.target || undefined} /> : loading ? <div className="skeleton h-40" /> : <p className="py-6 text-center text-sm text-slate-400">-</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!departed && (
                      <ButtonLink size="sm" href={`/results?from=${w.from}&to=${w.to}&date=${w.date}&pax=1&cabin=${w.cabin}`}>
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {t("watch.searchNow")}
                      </ButtonLink>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(w.id)} data-testid="watch-remove">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {t("watch.remove")}
                    </Button>
                    <Link href={`/predict?from=${w.from}&to=${w.to}&date=${w.date}&cabin=${w.cabin}`} className="ms-auto self-center text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
                      {t("results.predictRoute")} →
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
