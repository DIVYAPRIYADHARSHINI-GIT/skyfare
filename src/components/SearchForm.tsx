"use client";
// Flight search form (home, results, budget, predict). Validates on the
// client with the same rules as the API and supports voice search.
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ArrowLeftRight, CalendarDays, Search, Users } from "lucide-react";
import type { MessageKey } from "@/i18n/messages/en";
import { useI18n } from "@/i18n";
import { addDays, diffDays, isValidISO, todayISO } from "@/lib/sim/dates";
import { readLastSearch, saveLastSearch } from "@/lib/storage";
import { AirportInput } from "./AirportInput";
import { Button, inputClass } from "./ui";
import { useVoiceSearch, VoiceButton, type VoiceOutcome, VoiceStatusMessage } from "./VoiceButton";

export interface SearchValues {
  from: string;
  to: string;
  date: string;
  pax: number;
  cabin: "economy" | "business";
}

export function defaultSearch(): SearchValues {
  return { from: "MAA", to: "DEL", date: addDays(todayISO(), 21), pax: 1, cabin: "economy" };
}

export function validateSearch(v: SearchValues, { needPax = true } = {}): MessageKey | null {
  const today = todayISO();
  if (!v.from) return "search.error.unknownFrom";
  if (!v.to) return "search.error.unknownTo";
  if (v.from === v.to) return "search.error.sameAirport";
  if (!isValidISO(v.date)) return "search.error.badDate";
  if (diffDays(v.date, today) < 0) return "search.error.pastDate";
  if (diffDays(v.date, today) > 330) return "search.error.tooFar";
  if (needPax && (v.pax < 1 || v.pax > 9)) return "search.error.badPax";
  return null;
}

export function toQuery(v: SearchValues) {
  return new URLSearchParams({ from: v.from, to: v.to, date: v.date, pax: String(v.pax), cabin: v.cabin }).toString();
}

export function SearchForm({
  initial,
  action = "/results",
  onSubmit,
  submitLabel,
  compact = false,
  showPax = true,
  autoSubmitVoice = true,
}: {
  initial?: Partial<SearchValues>;
  /** Route to navigate to on submit (ignored when onSubmit is given). */
  action?: string;
  onSubmit?: (v: SearchValues) => void;
  submitLabel?: string;
  compact?: boolean;
  showPax?: boolean;
  autoSubmitVoice?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const ids = useId();
  const [v, setV] = useState<SearchValues>(() => ({ ...defaultSearch(), ...initial }));
  const [error, setError] = useState<MessageKey | null>(null);
  const [highlight, setHighlight] = useState<{ from?: boolean; to?: boolean }>({});
  const [outcome, setOutcome] = useState<VoiceOutcome | null>(null);

  // Restore the last search on pages without an explicit initial value.
  useEffect(() => {
    if (!initial?.from) {
      const last = readLastSearch();
      if (last && diffDays(last.date, todayISO()) >= 0) setV((p) => ({ ...p, ...last }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (vals: SearchValues) => {
    const err = validateSearch(vals, { needPax: showPax });
    setError(err);
    if (err) return;
    saveLastSearch(vals);
    if (onSubmit) onSubmit(vals);
    else router.push(`${action}?${toQuery(vals)}`);
  };

  const voice = useVoiceSearch((r) => {
    setOutcome(r);
    const q = r.query;
    const next: SearchValues = {
      ...v,
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
      ...(q.date ? { date: q.date } : {}),
      ...(q.pax ? { pax: q.pax } : {}),
      ...(q.cabin ? { cabin: q.cabin } : {}),
    };
    setV(next);
    setHighlight({ from: !q.from, to: !q.to });
    if (q.from && q.to && autoSubmitVoice) setTimeout(() => submit(next), 600);
  });

  const today = todayISO();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(v);
      }}
      className="flex flex-col gap-3"
      data-testid="search-form"
    >
      <div className={`grid gap-3 ${compact ? "md:grid-cols-[1fr_auto_1fr_10rem_auto]" : showPax ? "md:grid-cols-[1fr_auto_1fr] lg:grid-cols-[1fr_auto_1fr_11rem_8rem_9rem]" : "md:grid-cols-[1fr_auto_1fr_11rem_9rem]"} items-end`}>
        <AirportInput label={t("search.from")} value={v.from} onChange={(from) => { setV({ ...v, from }); setHighlight((h) => ({ ...h, from: false })); }} invalid={error === "search.error.unknownFrom"} testId="from-input" highlight={highlight.from} />
        <button
          type="button"
          onClick={() => setV({ ...v, from: v.to, to: v.from })}
          className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-brand-600 shadow-sm transition hover:rotate-180 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-300"
          aria-label={t("search.swap")}
          title={t("search.swap")}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <AirportInput label={t("search.to")} value={v.to} onChange={(to) => { setV({ ...v, to }); setHighlight((h) => ({ ...h, to: false })); }} invalid={error === "search.error.unknownTo" || error === "search.error.sameAirport"} testId="to-input" highlight={highlight.to} />
        <div>
          <label htmlFor={`${ids}-date`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t("search.date")}
          </label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" aria-hidden="true" />
            <input
              id={`${ids}-date`}
              type="date"
              data-testid="date-input"
              min={today}
              max={addDays(today, 330)}
              value={v.date}
              onChange={(e) => setV({ ...v, date: e.target.value })}
              aria-invalid={error?.includes("Date") || error === "search.error.tooFar" || undefined}
              className={`${inputClass} ps-9`}
            />
          </div>
        </div>
        {showPax && !compact && (
          <div>
            <label htmlFor={`${ids}-pax`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("search.passengers")}
            </label>
            <div className="relative">
              <Users className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" aria-hidden="true" />
              <select id={`${ids}-pax`} data-testid="pax-input" value={v.pax} onChange={(e) => setV({ ...v, pax: Number(e.target.value) })} className={`${inputClass} appearance-none ps-9`}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {!compact && (
          <div>
            <label htmlFor={`${ids}-cabin`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("search.class")}
            </label>
            <select id={`${ids}-cabin`} data-testid="cabin-input" value={v.cabin} onChange={(e) => setV({ ...v, cabin: e.target.value as SearchValues["cabin"] })} className={`${inputClass} appearance-none`}>
              <option value="economy">{t("search.economy")}</option>
              <option value="business">{t("search.business")}</option>
            </select>
          </div>
        )}
        {compact && (
          <Button type="submit" className="h-11" data-testid="search-submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            {submitLabel ?? t("search.submit")}
          </Button>
        )}
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" className="flex-1 sm:flex-none" data-testid="search-submit">
            <Search className="h-5 w-5" aria-hidden="true" />
            {submitLabel ?? t("search.submit")}
          </Button>
          <VoiceButton listening={voice.status.state === "listening"} onStart={voice.start} onStop={voice.stop} supported={voice.supported} />
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <VoiceStatusMessage status={voice.status} outcome={outcome} />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" data-testid="search-error" className="text-sm font-medium text-rose-600 dark:text-rose-400">
          {t(error)}
        </p>
      )}
    </form>
  );
}
