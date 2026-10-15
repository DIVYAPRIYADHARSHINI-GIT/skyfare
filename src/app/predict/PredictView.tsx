"use client";
// ML price prediction: 30-day forecast chart + Book now / Wait recommendation
// with a confidence level and the reasons behind it.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BarChart3, Bell, Brain, Clock, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { useApi } from "@/lib/client";
import { addDays, todayISO } from "@/lib/sim/dates";
import { addWatch } from "@/lib/storage";
import type { PredictResponse } from "@/lib/types";
import { ForecastChart, TravelDateChart } from "@/components/charts";
import { TakeoffPlane } from "@/components/illustrations";
import { ReadAloud } from "@/components/ReadAloud";
import { SearchForm, toQuery, type SearchValues } from "@/components/SearchForm";
import { Badge, Button, ButtonLink, Card, EmptyState, Loading, Notice, PageHeader } from "@/components/ui";

export function PredictView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t, tk, formatPrice, formatDate, city } = useI18n();
  const has = Boolean(sp.get("from") && sp.get("to") && sp.get("date"));
  const q: SearchValues = {
    from: sp.get("from") ?? "MAA",
    to: sp.get("to") ?? "DEL",
    date: sp.get("date") ?? addDays(todayISO(), 30),
    pax: Number(sp.get("pax") ?? 1),
    cabin: sp.get("cabin") === "business" ? "business" : "economy",
  };
  const { data, loading, error, reload } = useApi<PredictResponse>(has ? `/api/predict?${toQuery(q)}` : null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (v: SearchValues) => router.push(`${pathname}?${toQuery(v)}`, { scroll: false });
  const book = data?.action === "book";
  const actionText = data ? (book ? t("predict.book") : t("predict.wait")) : "";
  const speakText = data
    ? `${t("predict.speak", { from: city(q.from), to: city(q.to), date: formatDate(q.date, { day: "numeric", month: "long" }), action: actionText, confidence: data.confidence })} ${
        book ? t("predict.bookBody", { price: formatPrice(data.predictedToday) }) : t("predict.waitBody", { price: formatPrice(data.best.predicted), days: data.waitDays, amount: formatPrice(data.expectedSaving) })
      }`
    : "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader title={t("predict.title")} subtitle={t("predict.subtitle")} icon={<Brain className="h-6 w-6" />} />
      <Card className="mb-5 p-4">
        <SearchForm key={sp.toString()} initial={has ? q : undefined} onSubmit={go} submitLabel={t("predict.run")} showPax={false} autoSubmitVoice />
      </Card>

      {!has ? (
        <Card>
          <EmptyState title={t("budget.prompt")} body={t("predict.subtitle")} />
        </Card>
      ) : loading ? (
        <Card>
          <Loading label={t("predict.loading")} />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            title={error.status === 400 ? t(`search.error.${error.code}` as MessageKey) : t("results.error")}
            action={
              error.status !== 400 && (
                <Button variant="secondary" onClick={reload}>
                  {t("results.retry")}
                </Button>
              )
            }
          />
        </Card>
      ) : data ? (
        <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
          <div className="space-y-5">
            {/* Recommendation */}
            <Card
              className={`overflow-hidden ${book ? "border-emerald-300 dark:border-emerald-800" : "border-amber-300 dark:border-amber-800"}`}
            >
              <div
                data-testid="recommendation"
                data-action={data.action}
                className={`p-5 ${book ? "bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/60 dark:to-slate-900" : "bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/50 dark:to-slate-900"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {city(q.from)} → {city(q.to)} · {formatDate(q.date, { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <h2 className={`mt-2 flex items-center gap-2 text-2xl font-extrabold ${book ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {book ? (
                    <>
                      <TakeoffPlane className="text-emerald-600 dark:text-emerald-300" />
                      {t("predict.book")}
                    </>
                  ) : (
                    <>
                      <Clock className="h-6 w-6" aria-hidden="true" />
                      {t("predict.wait")}
                    </>
                  )}
                </h2>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  {book
                    ? t("predict.bookBody", { price: formatPrice(data.predictedToday) })
                    : t("predict.waitBody", { price: formatPrice(data.best.predicted), days: data.waitDays, amount: formatPrice(data.expectedSaving) })}
                </p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{t("predict.confidence")}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={data.confidenceLabel === "high" ? "green" : data.confidenceLabel === "medium" ? "amber" : "slate"}>{t(`predict.confidence.${data.confidenceLabel}` as MessageKey)}</Badge>
                      <span className="tabular font-bold text-slate-900 dark:text-white" data-testid="confidence">
                        {data.confidence}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={data.confidence} aria-valuemin={0} aria-valuemax={100} aria-label={t("predict.confidence")}>
                    <div className={`h-full rounded-full ${book ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${data.confidence}%` }} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {book ? (
                    <ButtonLink href={`/results?${toQuery(q)}`} variant="success">
                      {t("predict.book")}
                    </ButtonLink>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const r = addWatch({ from: q.from, to: q.to, date: q.date, cabin: q.cabin, target: Math.round(data.best.predicted / 50) * 50 });
                        setNotice(r === "added" ? t("watch.added", { from: city(q.from), to: city(q.to) }) : r === "exists" ? t("watch.exists") : t("watch.full"));
                      }}
                    >
                      <Bell className="h-4 w-4" aria-hidden="true" />
                      {t("results.trackRoute")}
                    </Button>
                  )}
                  <ReadAloud text={speakText} />
                </div>
              </div>
            </Card>
            {notice && (
              <Notice tone="success" onClose={() => setNotice(null)} closeLabel={t("common.close")}>
                {notice}{" "}
                <Link href="/watchlist" className="font-semibold underline">
                  {t("nav.watchlist")}
                </Link>
              </Notice>
            )}

            <Card className="p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{t("predict.currentFare")}</dt>
                  <dd className="tabular text-lg font-bold text-slate-900 dark:text-white" data-testid="current-fare">
                    {data.currentFare !== null ? formatPrice(data.currentFare) : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{t("predict.predictedToday")}</dt>
                  <dd className="tabular text-lg font-bold text-slate-900 dark:text-white">{formatPrice(data.predictedToday)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{t("predict.bestDay")}</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {formatDate(data.best.bookingDate, { weekday: "long", day: "numeric", month: "long" })} · <span className="tabular">{formatPrice(data.best.predicted)}</span>
                    <span className="block text-xs font-normal text-slate-500">{t("predict.daysBefore", { days: data.best.daysBefore })}</span>
                  </dd>
                </div>
              </dl>
              <h3 className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                <Info className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {t("predict.why")}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300" data-testid="reasons">
                {data.reasons.map((r) => (
                  <li key={r.key} className="flex gap-2">
                    {r.key.includes("drop") ? <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" /> : <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />}
                    <span>{tk(r.key, r.params && Object.fromEntries(Object.entries(r.params).map(([k, v]) => [k, k === "amount" ? formatPrice(Number(v)) : v])))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <BarChart3 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {t("predict.chart.title")}
              </h2>
              <ForecastChart data={data.forecast} best={data.best} />
            </Card>
            <Card className="p-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("predict.travelCurve.title")}</h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t("predict.travelCurve.subtitle", { date: formatDate(q.date) })}</p>
              <TravelDateChart data={data.travelDateCurve} selected={q.date} onSelect={(d) => go({ ...q, date: d })} />
            </Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("predict.disclaimer")}{" "}
              <Link href="/about" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
                {t("nav.about")} →
              </Link>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
