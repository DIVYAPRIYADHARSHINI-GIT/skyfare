"use client";
import { useState } from "react";
import { ChevronDown, Clock, Luggage, Plane } from "lucide-react";
import { useI18n } from "@/i18n";
import type { ScoredFlight } from "@/lib/types";
import { AirlineLogo } from "./AirlineLogo";
import { Badge, Button } from "./ui";

export function FlightCard({
  f,
  pax,
  badges,
  onSelect,
  dimmed = false,
}: {
  f: ScoredFlight;
  pax: number;
  badges: Array<"cheapest" | "fastest" | "best">;
  onSelect: () => void;
  dimmed?: boolean;
}) {
  const { t, formatPrice, formatDuration, city } = useI18n();
  const [open, setOpen] = useState(false);
  const stopsLabel = f.stops === 0 ? t("results.stops.0") : f.stops === 1 ? t("results.stops.1") : t("results.stops.2");
  return (
    <li
      data-testid="flight-card"
      data-price={f.price}
      data-duration={f.durationMin}
      data-stops={f.stops}
      data-airline={f.airline}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
        badges.includes("cheapest") ? "border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-800 dark:ring-emerald-900" : "border-slate-200 dark:border-slate-800"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {badges.includes("cheapest") && <Badge tone="green">{t("results.badge.cheapest")}</Badge>}
          {badges.includes("fastest") && <Badge tone="violet">{t("results.badge.fastest")}</Badge>}
          {badges.includes("best") && <Badge tone="brand">{t("results.badge.best")}</Badge>}
        </div>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 p-4 sm:grid-cols-[13rem_1fr_auto] sm:items-center">
        <div className="flex items-center gap-3">
          <AirlineLogo code={f.airline} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{f.airlineName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {f.flightNo} · {f.aircraft}
            </p>
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
          <div className="text-center">
            <p className="tabular text-lg font-bold text-slate-900 dark:text-white">{f.depTime}</p>
            <p className="text-xs font-medium text-slate-500">{f.from}</p>
          </div>
          <div className="flex flex-1 flex-col items-center px-1">
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatDuration(f.durationMin)}
            </p>
            <div className="relative my-1 h-px w-full bg-slate-300 dark:bg-slate-700">
              {f.via.map((_, i) => (
                <span key={i} className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-amber-500 bg-white dark:bg-slate-900" style={{ insetInlineStart: `${((i + 1) / (f.via.length + 1)) * 100}%` }} />
              ))}
              <Plane className="rtl-flip absolute -top-2 end-0 h-4 w-4 rotate-45 text-brand-500" aria-hidden="true" />
            </div>
            <p className={`text-xs font-medium ${f.stops === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {stopsLabel}
              {f.via.length > 0 && ` · ${t("results.stopsVia", { via: f.via.join(", ") })}`}
            </p>
          </div>
          <div className="text-center">
            <p className="tabular text-lg font-bold text-slate-900 dark:text-white">
              {f.arrTime}
              {f.arrDayOffset > 0 && <sup className="ms-0.5 text-[10px] font-semibold text-rose-500">{t("results.nextDay", { days: f.arrDayOffset })}</sup>}
            </p>
            <p className="text-xs font-medium text-slate-500">{f.to}</p>
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-0 dark:border-slate-700">
          <div className="sm:text-end">
            <p className="tabular text-xl font-extrabold text-slate-900 dark:text-white" data-testid="flight-price">
              {formatPrice(f.price)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("results.perPerson")}
              {pax > 1 && ` · ${t("results.total", { price: formatPrice(f.price * pax) })}`}
            </p>
            {f.seatsLeft <= 6 && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{t("results.seatsLeft", { count: f.seatsLeft })}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t("results.details")}
              <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <Button onClick={onSelect} data-testid="select-flight">
              {t("results.select")}
            </Button>
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
          <ul className="space-y-1">
            {f.via.length === 0 ? (
              <li className="flex items-center gap-2">
                <Plane className="rtl-flip h-4 w-4 text-brand-500" aria-hidden="true" />
                {city(f.from)} ({f.from}) → {city(f.to)} ({f.to}) · {formatDuration(f.durationMin)}
              </li>
            ) : (
              f.via.map((v, i) => (
                <li key={v} className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  {t("results.layover", { duration: formatDuration(f.layoverMin[i] ?? 0), city: `${city(v)} (${v})` })}
                </li>
              ))
            )}
            <li className="flex items-center gap-2">
              <Luggage className="h-4 w-4 text-slate-400" aria-hidden="true" />
              {f.cabin === "business" ? "2 × 32 kg" : "15 kg"} + 7 kg · {f.cabin === "business" ? t("search.business") : t("search.economy")}
            </li>
          </ul>
        </div>
      )}
    </li>
  );
}
