"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BarChart3, Bell, PiggyBank } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { useApi } from "@/lib/client";
import { addWatch } from "@/lib/storage";
import type { SearchResponse } from "@/lib/types";
import { DestinationImage } from "@/components/DestinationImage";
import { FlightList } from "@/components/FlightList";
import { ReadAloud } from "@/components/ReadAloud";
import { SearchForm, toQuery, type SearchValues } from "@/components/SearchForm";
import { Button, ButtonLink, Card, EmptyState, Loading, Notice, Skeleton } from "@/components/ui";

export function ResultsView() {
  const sp = useSearchParams();
  const { t, formatDate, formatPrice, city } = useI18n();
  const q: SearchValues = {
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    date: sp.get("date") ?? "",
    pax: Number(sp.get("pax") ?? 1),
    cabin: sp.get("cabin") === "business" ? "business" : "economy",
  };
  const url = q.from && q.to && q.date ? `/api/flights?${toQuery(q)}` : null;
  const { data, error, loading, reload } = useApi<SearchResponse>(url);
  const [notice, setNotice] = useState<string | null>(null);

  const cheapest = data?.flights.find((f) => f.id === data.highlights.cheapest);
  const readText =
    data && cheapest
      ? t("results.readSummary", {
          count: data.flights.length,
          from: city(q.from),
          to: city(q.to),
          date: formatDate(q.date, { weekday: "long", day: "numeric", month: "long" }),
          airline: cheapest.airlineName,
          price: formatPrice(cheapest.price),
          time: cheapest.depTime,
        })
      : "";

  const track = () => {
    const target = cheapest ? Math.round((cheapest.price * 0.92) / 50) * 50 : 0;
    const r = addWatch({ from: q.from, to: q.to, date: q.date, cabin: q.cabin, target });
    setNotice(r === "added" ? t("watch.added", { from: city(q.from), to: city(q.to) }) : r === "exists" ? t("watch.exists") : t("watch.full"));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Destination banner */}
      {q.to && (
        <div className="relative mb-5 overflow-hidden rounded-3xl">
          <DestinationImage code={q.to} alt={city(q.to)} className="h-36 sm:h-44" sizes="100vw" preload />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950/80 via-brand-900/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 text-white sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{t("results.destination")}</p>
            <h1 className="text-2xl font-extrabold drop-shadow sm:text-3xl" data-testid="results-title">
              {t("results.title", { from: city(q.from), to: city(q.to) })}
            </h1>
            {data && (
              <p className="mt-1 text-sm text-white/90">
                {t("results.summary", {
                  count: data.flights.length,
                  date: formatDate(q.date, { weekday: "short", day: "numeric", month: "short" }),
                  pax: t("search.passengerCount", { count: q.pax }),
                  cabin: q.cabin === "business" ? t("search.business") : t("search.economy"),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      <Card className="mb-5 p-4">
        <SearchForm key={sp.toString()} initial={q.from ? q : undefined} />
      </Card>

      {data && data.flights.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ReadAloud text={readText} />
          <Button variant="secondary" size="sm" onClick={track} data-testid="track-route">
            <Bell className="h-4 w-4" aria-hidden="true" />
            {t("results.trackRoute")}
          </Button>
          <ButtonLink variant="secondary" size="sm" href={`/predict?${toQuery(q)}`}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {t("results.predictRoute")}
          </ButtonLink>
          <ButtonLink variant="secondary" size="sm" href={`/budget?${toQuery(q)}`}>
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
            {t("results.budgetRoute")}
          </ButtonLink>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Notice tone="success" onClose={() => setNotice(null)} closeLabel={t("common.close")}>
            {notice}{" "}
            <Link href="/watchlist" className="font-semibold underline">
              {t("nav.watchlist")}
            </Link>
          </Notice>
        </div>
      )}

      {!url ? (
        <Card>
          <EmptyState title={t("budget.prompt")} />
        </Card>
      ) : loading ? (
        <div>
          <Loading label={t("results.loading")} />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Card>
          <EmptyState
            title={error.status === 400 ? t(`search.error.${error.code}` as MessageKey) : error.code === "offline" ? t("common.offline") : t("results.error")}
            action={
              error.status !== 400 && (
                <Button onClick={reload} variant="secondary">
                  {t("results.retry")}
                </Button>
              )
            }
          />
        </Card>
      ) : data && data.flights.length === 0 ? (
        <Card>
          <EmptyState
            title={t("results.none.title")}
            body={t("results.none.body", { pax: t("search.passengerCount", { count: q.pax }) })}
            action={
              <ButtonLink href={`/budget?${toQuery(q)}`} variant="secondary">
                {t("nav.budget")}
              </ButtonLink>
            }
          />
        </Card>
      ) : data ? (
        <FlightList flights={data.flights} pax={q.pax} highlights={data.highlights} />
      ) : null}
    </div>
  );
}
