"use client";
// Budget mode: max budget (only matching flights), highlighted cheapest
// option, fare calendar, cheaper nearby dates and nearby airports.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, PiggyBank, Plane, Sparkles, Wallet } from "lucide-react";
import { useI18n } from "@/i18n";
import { useApi } from "@/lib/client";
import { addDays, todayISO } from "@/lib/sim/dates";
import type { BudgetResponse, SearchResponse } from "@/lib/types";
import { AirlineLogo } from "@/components/AirlineLogo";
import { FareCalendar } from "@/components/FareCalendar";
import { FlightList } from "@/components/FlightList";
import { ReadAloud } from "@/components/ReadAloud";
import { SearchForm, toQuery, type SearchValues } from "@/components/SearchForm";
import { Badge, Button, Card, EmptyState, Loading, Notice, PageHeader, Skeleton, inputClass } from "@/components/ui";

const BUDGET_KEY = "skyfare.budget";

export function BudgetView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t, formatPrice, formatDate, city } = useI18n();
  const has = Boolean(sp.get("from") && sp.get("to"));
  const q: SearchValues = {
    from: sp.get("from") ?? "MAA",
    to: sp.get("to") ?? "DEL",
    date: sp.get("date") ?? addDays(todayISO(), 21),
    pax: Number(sp.get("pax") ?? 1),
    cabin: sp.get("cabin") === "business" ? "business" : "economy",
  };
  const [budget, setBudget] = useState<number | null>(null);
  const [month, setMonth] = useState(q.date.slice(0, 7));

  useEffect(() => {
    const b = Number(sp.get("budget") ?? localStorage.getItem(BUDGET_KEY) ?? 0);
    setBudget(b > 0 ? b : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setMonth(q.date.slice(0, 7));
  }, [q.date]);

  const go = (v: SearchValues) => router.push(`${pathname}?${toQuery(v)}${budget ? `&budget=${budget}` : ""}`, { scroll: false });
  const updateBudget = (b: number | null) => {
    setBudget(b);
    try {
      if (b) localStorage.setItem(BUDGET_KEY, String(b));
      else localStorage.removeItem(BUDGET_KEY);
    } catch {
      /* ignore */
    }
  };

  const flights = useApi<SearchResponse>(has ? `/api/flights?${toQuery(q)}` : null);
  const sugg = useApi<BudgetResponse>(has ? `/api/budget?${toQuery(q)}` : null);
  const all = flights.data?.flights ?? [];
  const cheapest = all.length ? all.reduce((m, f) => (f.price < m.price ? f : m)) : null;
  const within = budget ? all.filter((f) => f.price <= budget) : all;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader title={t("budget.title")} subtitle={t("budget.subtitle")} icon={<PiggyBank className="h-6 w-6" />} />
      <Card className="mb-5 p-4">
        <SearchForm key={sp.toString()} initial={has ? q : undefined} onSubmit={go} />
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center dark:border-slate-800">
          <label htmlFor="budget" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Wallet className="h-4 w-4 text-brand-600" aria-hidden="true" />
            {t("budget.maxBudget")}
          </label>
          <div className="flex flex-1 items-center gap-3">
            <input
              id="budget"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              data-testid="budget-input"
              placeholder={t("budget.noLimit")}
              value={budget ?? ""}
              onChange={(e) => updateBudget(e.target.value ? Math.max(0, Number(e.target.value)) || null : null)}
              className={`${inputClass} max-w-[11rem]`}
            />
            {cheapest && (
              <input
                type="range"
                aria-label={t("budget.maxBudget")}
                min={Math.floor(cheapest.price / 100) * 100}
                max={Math.ceil(Math.max(...all.map((f) => f.price)) / 100) * 100}
                step={100}
                value={budget ?? Math.ceil(Math.max(...all.map((f) => f.price)) / 100) * 100}
                onChange={(e) => updateBudget(Number(e.target.value))}
                className="hidden flex-1 accent-brand-600 sm:block"
              />
            )}
            {budget && (
              <Button variant="ghost" size="sm" onClick={() => updateBudget(null)}>
                {t("budget.noLimit")}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {!has ? (
        <Card>
          <EmptyState title={t("budget.prompt")} />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-5">
            {/* Cheapest option highlight */}
            {flights.loading ? (
              <Skeleton className="h-28" />
            ) : cheapest ? (
              <Card className="overflow-hidden border-emerald-300 dark:border-emerald-800">
                <div className="flex flex-col gap-4 bg-gradient-to-br from-emerald-50 to-white p-5 sm:flex-row sm:items-center dark:from-emerald-950/50 dark:to-slate-900" data-testid="cheapest-option">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white">
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t("budget.cheapestOption")}</p>
                      <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                        <AirlineLogo code={cheapest.airline} size={22} />
                        {cheapest.airlineName} · {cheapest.depTime} → {cheapest.arrTime}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {cheapest.flightNo} · {cheapest.stops === 0 ? t("results.stops.0") : cheapest.stops === 1 ? t("results.stops.1") : t("results.stops.2")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:ms-auto">
                    <p className="tabular text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{formatPrice(cheapest.price)}</p>
                    <Button variant="success" onClick={() => router.push(`/book?flight=${encodeURIComponent(cheapest.id)}&pax=${q.pax}`)}>
                      {t("results.select")}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {budget && flights.data && (
              <Notice tone={within.length ? "success" : "warn"}>
                <span data-testid="budget-summary">
                  {within.length ? t("budget.withinBudget", { count: within.length }) : t("budget.noneWithin", { budget: formatPrice(budget), price: formatPrice(cheapest?.price ?? 0) })}
                </span>
              </Notice>
            )}

            {flights.loading ? (
              <Loading label={t("results.loading")} />
            ) : flights.error ? (
              <Notice tone="error">{t("results.error")}</Notice>
            ) : all.length === 0 ? (
              <Card>
                <EmptyState title={t("results.none.title")} body={t("results.none.body", { pax: t("search.passengerCount", { count: q.pax }) })} />
              </Card>
            ) : (
              flights.data && <FlightList key={`${sp.toString()}-${budget}`} flights={all} pax={q.pax} highlights={flights.data.highlights} budget={budget} />
            )}
          </div>

          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {t("budget.calendar")}
              </h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t("budget.calendar.hint")}</p>
              <FareCalendar from={q.from} to={q.to} cabin={q.cabin} month={month} onMonth={setMonth} selected={q.date} onSelect={(date) => go({ ...q, date })} budget={budget} />
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {t("budget.nearbyDates")}
              </h2>
              {sugg.loading ? (
                <Skeleton className="h-32" />
              ) : sugg.data ? (
                <ul className="space-y-2" data-testid="nearby-dates">
                  {sugg.data.nearbyDates.slice(0, 6).map((d) => (
                    <li key={d.date}>
                      <button
                        type="button"
                        onClick={() => go({ ...q, date: d.date })}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-start text-sm hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(d.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                        <span className="flex items-center gap-2">
                          <span className="tabular font-semibold">{formatPrice(d.price)}</span>
                          {d.saving > 0 ? (
                            <Badge tone="green">{t("budget.save", { amount: formatPrice(d.saving) })}</Badge>
                          ) : d.saving < 0 ? (
                            <Badge tone="slate">{t("budget.more", { amount: formatPrice(-d.saving) })}</Badge>
                          ) : (
                            <Badge tone="slate">{t("budget.sameprice")}</Badge>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {t("budget.nearbyAirports")}
              </h2>
              {sugg.loading ? (
                <Skeleton className="h-24" />
              ) : sugg.data && sugg.data.nearbyAirports.length ? (
                <ul className="space-y-2" data-testid="nearby-airports">
                  {sugg.data.nearbyAirports.map((a) => (
                    <li key={`${a.from}${a.to}`}>
                      <button
                        type="button"
                        onClick={() => go({ ...q, from: a.from, to: a.to })}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-start text-sm hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                            <Plane className="rtl-flip h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
                            {t("budget.fly", { from: `${city(a.from)} (${a.from})`, to: `${city(a.to)} (${a.to})` })}
                          </span>
                          <span className="text-xs text-slate-500">{t("budget.kmAway", { km: a.km })}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className="tabular font-semibold">{formatPrice(a.price)}</span>
                          {a.saving > 0 && <Badge tone="green">{t("budget.save", { amount: formatPrice(a.saving) })}</Badge>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("budget.noAlternatives")}</p>
              )}
            </Card>
            {cheapest && (
              <ReadAloud
                text={`${t("budget.cheapestOption")}: ${cheapest.airlineName}, ${cheapest.depTime}, ${formatPrice(cheapest.price)}.${
                  sugg.data?.nearbyDates[0] && sugg.data.nearbyDates[0].saving > 0
                    ? ` ${t("budget.nearbyDates")}: ${formatDate(sugg.data.nearbyDates[0].date, { weekday: "long", day: "numeric", month: "long" })}, ${formatPrice(sugg.data.nearbyDates[0].price)}.`
                    : ""
                }`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
