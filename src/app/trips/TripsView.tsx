"use client";
// My trips: booked flights (confirmed / completed / cancelled) and tracked
// routes (watching / price below target / departed), all from localStorage.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Download, Plane, Ticket, XCircle } from "lucide-react";
import { useI18n } from "@/i18n";
import { diffDays, todayISO } from "@/lib/sim/dates";
import { useBookings, useWatchlist } from "@/lib/storage";
import { downloadTicket } from "@/lib/ticket";
import { AirlineLogo } from "@/components/AirlineLogo";
import { DestinationImage } from "@/components/DestinationImage";
import { Badge, Button, ButtonLink, Card, EmptyState, Loading, PageHeader } from "@/components/ui";

export function TripsView() {
  const { t, formatPrice, formatDate, formatDuration, city } = useI18n();
  const [bookings, setBookings] = useBookings();
  const [watchlist] = useWatchlist();
  const [tab, setTab] = useState<"booked" | "tracked">("booked");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const today = todayISO();

  const cancel = (ref: string) => {
    if (!window.confirm(t("trips.cancelConfirm", { ref }))) return;
    setBookings((list) => list.map((b) => (b.ref === ref ? { ...b, status: "cancelled" } : b)));
  };

  const sorted = [...bookings].sort((a, b) => a.flight.date.localeCompare(b.flight.date));
  const upcoming = sorted.filter((b) => diffDays(b.flight.date, today) >= 0);
  const past = sorted.filter((b) => diffDays(b.flight.date, today) < 0).reverse();

  const statusOf = (b: (typeof bookings)[number]) =>
    b.status === "cancelled" ? ("cancelled" as const) : diffDays(b.flight.date, today) < 0 ? ("completed" as const) : ("confirmed" as const);

  const renderBooking = (b: (typeof bookings)[number]) => {
    const st = statusOf(b);
    return (
      <li key={b.ref} data-testid="trip-item">
        <Card className={`overflow-hidden ${st === "cancelled" ? "opacity-70" : ""}`}>
          <div className="grid sm:grid-cols-[10rem_1fr]">
            <DestinationImage code={b.flight.to} alt={city(b.flight.to)} className="h-28 sm:h-full" sizes="(max-width: 640px) 100vw, 160px" showCredit={false} />
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {city(b.flight.from)} → {city(b.flight.to)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(b.flight.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <Badge tone={st === "confirmed" ? "green" : st === "cancelled" ? "rose" : "slate"}>{t(`trips.status.${st}`)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-2">
                  <AirlineLogo code={b.flight.airline} size={20} />
                  {b.flight.airlineName} {b.flight.flightNo}
                </span>
                <span className="tabular">
                  {b.flight.depTime} → {b.flight.arrTime} · {formatDuration(b.flight.durationMin)}
                </span>
                <span>{t("trips.passengers", { count: b.passengers.length })}</span>
                <span className="tabular font-semibold text-slate-900 dark:text-white">{formatPrice(b.summary.total)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="me-auto font-mono text-sm font-bold tracking-widest text-brand-700 dark:text-brand-300">
                  {t("trips.ref")}: {b.ref}
                </span>
                <Button size="sm" variant="secondary" onClick={() => downloadTicket(b)} data-testid="trip-download">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t("trips.download")}
                </Button>
                {st === "confirmed" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(b.ref)}>
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    {t("trips.cancel")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader title={t("trips.title")} subtitle={t("trips.subtitle")} icon={<Ticket className="h-6 w-6" />} />
      <div role="tablist" className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {(["booked", "tracked"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            data-testid={`tab-${k}`}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            {k === "booked" ? <Ticket className="h-4 w-4" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
            {t(`trips.${k}`)} ({k === "booked" ? bookings.length : watchlist.length})
          </button>
        ))}
      </div>

      {!mounted ? (
        <Loading />
      ) : tab === "booked" ? (
        bookings.length === 0 ? (
          <Card>
            <EmptyState title={t("trips.empty.title")} body={t("trips.empty.body")} action={<ButtonLink href="/">{t("search.submit")}</ButtonLink>} />
          </Card>
        ) : (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("trips.upcoming")}</h2>
                <ul className="space-y-3">{upcoming.map(renderBooking)}</ul>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("trips.past")}</h2>
                <ul className="space-y-3">{past.map(renderBooking)}</ul>
              </section>
            )}
          </div>
        )
      ) : watchlist.length === 0 ? (
        <Card>
          <EmptyState title={t("watch.empty.title")} body={t("watch.empty.body")} action={<ButtonLink href="/watchlist">{t("watch.add")}</ButtonLink>} />
        </Card>
      ) : (
        <ul className="space-y-3">
          {watchlist.map((w) => {
            const departed = diffDays(w.date, today) < 0;
            const below = !departed && w.lastPrice !== undefined && w.target > 0 && w.lastPrice <= w.target;
            const st = departed ? "departed" : below ? "alert" : "watching";
            return (
              <li key={w.id} data-testid="tracked-item">
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <Plane className="rtl-flip h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {city(w.from)} → {city(w.to)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(w.date, { weekday: "short", day: "numeric", month: "short" })} · {t("watch.target")}: {w.target ? formatPrice(w.target) : "-"}
                      {w.lastPrice !== undefined && ` · ${t("watch.current")}: ${formatPrice(w.lastPrice)}`}
                    </p>
                  </div>
                  <Badge tone={st === "alert" ? "green" : st === "departed" ? "slate" : "brand"}>{t(`trips.status.${st}`)}</Badge>
                  <Link href="/watchlist" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
                    {t("trips.view")} →
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
