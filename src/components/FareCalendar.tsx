"use client";
// Month grid of the lowest fare per day, coloured low / mid / high, with
// festival markers. Clicking a day selects that travel date.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { useApi } from "@/lib/client";
import { dayOfWeek, todayISO } from "@/lib/sim/dates";
import type { CalendarResponse } from "@/lib/types";
import { Skeleton } from "./ui";

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function FareCalendar({
  from,
  to,
  cabin,
  month,
  onMonth,
  selected,
  onSelect,
  budget,
}: {
  from: string;
  to: string;
  cabin: "economy" | "business";
  month: string;
  onMonth: (m: string) => void;
  selected: string;
  onSelect: (date: string) => void;
  budget?: number | null;
}) {
  const { t, formatPrice, formatNumber, weekday, formatDate, info } = useI18n();
  const { data, loading } = useApi<CalendarResponse>(`/api/calendar?from=${from}&to=${to}&month=${month}&cabin=${cabin}`);
  const thisMonth = todayISO().slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, 10);
  const lead = data ? dayOfWeek(data.days[0].date) : 0;
  const compact = (p: number) => (p >= 100000 ? `${formatNumber(Math.round(p / 1000))}k` : p >= 10000 ? `${formatNumber(Math.round(p / 100) / 10, 1)}k` : formatNumber(p));

  return (
    <div data-testid="fare-calendar">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(shiftMonth(month, -1))}
          disabled={month <= thisMonth}
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("budget.calendar.prev")}
        >
          <ChevronLeft className="rtl-flip h-4 w-4" />
        </button>
        <h3 className="font-semibold text-slate-900 dark:text-white" data-testid="calendar-month">
          {new Intl.DateTimeFormat(info.intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T00:00:00Z`))}
        </h3>
        <button
          type="button"
          onClick={() => onMonth(shiftMonth(month, 1))}
          disabled={month >= lastMonth}
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("budget.calendar.next")}
        >
          <ChevronRight className="rtl-flip h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="truncate">
            {weekday(i).slice(0, 3)}
          </div>
        ))}
      </div>
      {loading || !data ? (
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`pad${i}`} />
          ))}
          {data.days.map((d) => {
            const day = Number(d.date.slice(8));
            const over = budget && d.price !== null && d.price > budget;
            const tone =
              d.price === null
                ? "bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700"
                : over
                  ? "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500"
                  : d.level === "low"
                    ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200"
                    : d.level === "mid"
                      ? "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                      : "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-200";
            const isSel = d.date === selected;
            return (
              <button
                key={d.date}
                type="button"
                disabled={d.price === null}
                onClick={() => onSelect(d.date)}
                data-testid={`cal-${d.date}`}
                data-level={d.level ?? ""}
                aria-pressed={isSel}
                aria-label={`${formatDate(d.date)}${d.price !== null ? `: ${formatPrice(d.price)}` : ""}${d.holiday ? ` - ${d.holiday}` : ""}`}
                title={d.holiday ?? undefined}
                className={`relative flex h-14 flex-col items-center justify-center rounded-lg text-xs transition ${tone} ${isSel ? "ring-2 ring-brand-600 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
              >
                <span className="font-semibold">{day}</span>
                {d.price !== null && <span className="tabular text-[10px] sm:text-[11px]">{compact(d.price)}</span>}
                {d.holiday && <span className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-800" />{t("budget.calendar.legend.low")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-800" />{t("budget.calendar.legend.mid")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-200 dark:bg-rose-800" />{t("budget.calendar.legend.high")}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />{t("budget.calendar.holiday")}</span>
      </div>
      {data && data.cheapestDays.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("budget.calendar.cheapestDays")}</p>
          <div className="flex flex-wrap gap-2" data-testid="cheapest-days">
            {data.cheapestDays.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => onSelect(d.date)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
              >
                {formatDate(d.date, { weekday: "short", day: "numeric", month: "short" })} · {formatPrice(d.price)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
