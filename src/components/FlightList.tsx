"use client";
// Results list with filters (price, stops, airline, departure time) and
// sorting (cheapest, fastest, best value, earliest). Filtering is instant
// because it runs on the flights already returned by /api/flights.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { AIRLINE_BY_CODE } from "@/lib/sim/airlines";
import { TIME_BUCKETS, type TimeBucket } from "@/lib/sim/fares";
import type { ScoredFlight } from "@/lib/types";
import { AirlineLogo } from "./AirlineLogo";
import { FlightCard } from "./FlightCard";
import { Button, Card, EmptyState } from "./ui";

export type SortKey = "cheapest" | "fastest" | "best" | "earliest";

export interface Filters {
  maxPrice: number | null;
  stops: number[]; // 0, 1, 2 (2 = 2+)
  airlines: string[];
  times: TimeBucket[];
}

export const emptyFilters: Filters = { maxPrice: null, stops: [], airlines: [], times: [] };

export function applyFilters(flights: ScoredFlight[], f: Filters): ScoredFlight[] {
  return flights.filter(
    (x) =>
      (f.maxPrice === null || x.price <= f.maxPrice) &&
      (!f.stops.length || f.stops.includes(Math.min(2, x.stops))) &&
      (!f.airlines.length || f.airlines.includes(x.airline)) &&
      (!f.times.length || f.times.includes(x.timeBucket)),
  );
}

export function sortFlights(flights: ScoredFlight[], key: SortKey): ScoredFlight[] {
  const arr = [...flights];
  const cmp: Record<SortKey, (a: ScoredFlight, b: ScoredFlight) => number> = {
    cheapest: (a, b) => a.price - b.price || a.durationMin - b.durationMin,
    fastest: (a, b) => a.durationMin - b.durationMin || a.price - b.price,
    best: (a, b) => a.valueScore - b.valueScore,
    earliest: (a, b) => a.depMin - b.depMin,
  };
  return arr.sort(cmp[key]);
}

function Chip({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-100"
          : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FlightList({
  flights,
  pax,
  highlights,
  budget,
  initialSort = "cheapest",
}: {
  flights: ScoredFlight[];
  pax: number;
  highlights: { cheapest: string | null; fastest: string | null; best: string | null };
  /** Budget mode: hard cap per person (only matching results are shown). */
  budget?: number | null;
  initialSort?: SortKey;
}) {
  const { t, formatPrice } = useI18n();
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

  const minPrice = flights.length ? Math.min(...flights.map((f) => f.price)) : 0;
  const maxPrice = flights.length ? Math.max(...flights.map((f) => f.price)) : 0;
  const airlines = useMemo(() => [...new Set(flights.map((f) => f.airline))].sort((a, b) => AIRLINE_BY_CODE[a].name.localeCompare(AIRLINE_BY_CODE[b].name)), [flights]);
  const stopsAvail = useMemo(() => [...new Set(flights.map((f) => Math.min(2, f.stops)))].sort(), [flights]);
  const timesAvail = useMemo(() => TIME_BUCKETS.filter((b) => flights.some((f) => f.timeBucket === b)), [flights]);

  const effective: Filters = { ...filters, maxPrice: budget ? Math.min(budget, filters.maxPrice ?? Infinity) : filters.maxPrice };
  const shown = sortFlights(applyFilters(flights, effective), sort);
  const active = filters.maxPrice !== null || filters.stops.length + filters.airlines.length + filters.times.length > 0;

  const select = (f: ScoredFlight) => router.push(`/book?flight=${encodeURIComponent(f.id)}&pax=${pax}`);

  const sorts: Array<[SortKey, MessageKey]> = [
    ["cheapest", "results.sort.cheapest"],
    ["fastest", "results.sort.fastest"],
    ["best", "results.sort.best"],
    ["earliest", "results.sort.earliest"],
  ];

  const filterPanel = (
    <Card className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("results.filters")}
        </h2>
        {active && (
          <button type="button" onClick={() => setFilters(emptyFilters)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300" data-testid="reset-filters">
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            {t("results.filters.reset")}
          </button>
        )}
      </div>
      <div>
        <label htmlFor="price-range" className="flex justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>{t("results.filter.price")}</span>
          <span className="tabular normal-case text-slate-800 dark:text-slate-200">{formatPrice(filters.maxPrice ?? maxPrice)}</span>
        </label>
        <input
          id="price-range"
          type="range"
          data-testid="price-filter"
          min={minPrice}
          max={maxPrice}
          step={50}
          value={filters.maxPrice ?? maxPrice}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFilters({ ...filters, maxPrice: v >= maxPrice ? null : v });
          }}
          className="mt-2 w-full accent-brand-600"
        />
        <div className="tabular flex justify-between text-[11px] text-slate-400">
          <span>{formatPrice(minPrice)}</span>
          <span>{formatPrice(maxPrice)}</span>
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("results.filter.stops")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {stopsAvail.map((s) => (
            <Chip key={s} active={filters.stops.includes(s)} onClick={() => setFilters({ ...filters, stops: toggle(filters.stops, s) })} testId={`stops-${s}`}>
              {t(`results.stops.${s}` as MessageKey)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("results.filter.time")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {timesAvail.map((b) => (
            <Chip key={b} active={filters.times.includes(b)} onClick={() => setFilters({ ...filters, times: toggle(filters.times, b) })} testId={`time-${b}`}>
              {t(`results.time.${b}` as MessageKey)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("results.filter.airlines")}</legend>
        <div className="flex flex-col gap-1.5">
          {airlines.map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <input type="checkbox" checked={filters.airlines.includes(a)} onChange={() => setFilters({ ...filters, airlines: toggle(filters.airlines, a) })} className="h-4 w-4 accent-brand-600" data-testid={`airline-${a}`} />
              <AirlineLogo code={a} size={20} />
              <span className="flex-1 text-slate-700 dark:text-slate-200">{AIRLINE_BY_CODE[a].name}</span>
              <span className="tabular text-xs text-slate-400">{formatPrice(Math.min(...flights.filter((f) => f.airline === a).map((f) => f.price)))}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
      <div className="lg:hidden">
        <Button variant="secondary" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="w-full" data-testid="toggle-filters">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {showFilters ? t("results.filters.hide") : t("results.filters.show")}
        </Button>
        {showFilters && <div className="mt-3">{filterPanel}</div>}
      </div>
      <aside className="hidden lg:block">{filterPanel}</aside>
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label={t("results.sort")} className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {sorts.map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={sort === k}
                data-testid={`sort-${k}`}
                onClick={() => setSort(k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${sort === k ? "bg-brand-600 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="results-count">
            {t("results.showing", { shown: shown.length, total: flights.length })}
          </p>
        </div>
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              title={t("results.empty.title")}
              body={t("results.empty.body")}
              action={
                active ? (
                  <Button variant="secondary" onClick={() => setFilters(emptyFilters)}>
                    {t("results.filters.reset")}
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <ul className="space-y-3" data-testid="flight-list">
            {shown.map((f) => (
              <FlightCard
                key={f.id}
                f={f}
                pax={pax}
                onSelect={() => select(f)}
                badges={[
                  ...(f.id === highlights.cheapest ? (["cheapest"] as const) : []),
                  ...(f.id === highlights.fastest ? (["fastest"] as const) : []),
                  ...(f.id === highlights.best ? (["best"] as const) : []),
                ]}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
