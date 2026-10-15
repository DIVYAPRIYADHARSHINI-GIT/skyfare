"use client";
// Dashboard: cheapest routes this month, trending destinations (with photos),
// average fare trends and best-time-to-book tips from the training data.
import Link from "next/link";
import { CalendarClock, Flame, LayoutDashboard, Lightbulb, MoonStar, PartyPopper, Plane, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { useApi } from "@/lib/client";
import type { DashboardResponse } from "@/lib/types";
import { IndexBarChart, MonthlyTrendChart } from "@/components/charts";
import { DestinationImage } from "@/components/DestinationImage";
import { Button, Card, EmptyState, Loading, PageHeader, Skeleton } from "@/components/ui";

export function DashboardView() {
  const { t, formatPrice, formatDate, formatNumber, city, weekday, monthName } = useI18n();
  const { data, loading, error, reload } = useApi<DashboardResponse>("/api/dashboard");

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")} icon={<LayoutDashboard className="h-6 w-6" />} />
        <Loading label={t("common.loading")} />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Card>
          <EmptyState title={t("results.error")} action={<Button onClick={reload}>{t("results.retry")}</Button>} />
        </Card>
      </div>
    );
  }

  const ins = data.insights;
  const lead = ins.leadTimeCurve;
  const lastMinute = lead[0].index;
  const sweet = lead.reduce((m, x) => (x.index < m.index ? x : m));
  const dow = ins.dayOfWeekCurve;
  const cheapestDay = dow.reduce((m, x) => (x.index < m.index ? x : m));
  const tod = ins.timeOfDayCurve;
  const evening = tod.find((x) => x.bucket === "evening")!.index;
  const cheapestTod = tod.reduce((m, x) => (x.index < m.index ? x : m));
  const months = ins.monthCurve;
  const cheapestMonth = months.reduce((m, x) => (x.index < m.index ? x : m));
  const peakMonth = months.reduce((m, x) => (x.index > m.index ? x : m));

  const tips: Array<{ icon: typeof Lightbulb; text: string }> = [
    { icon: CalendarClock, text: t("dash.tip.lead", { window: `${sweet.from}-${sweet.to}`, pct: Math.round((1 - sweet.index / lastMinute) * 100) }) },
    { icon: Plane, text: t("dash.tip.dow", { day: weekday(cheapestDay.day), pct: Math.round((1 - cheapestDay.index) * 100) }) },
    { icon: MoonStar, text: t("dash.tip.tod", { bucket: t(`results.time.${cheapestTod.bucket}` as MessageKey).replace(/\s*\(.*\)/, ""), pct: Math.round((1 - cheapestTod.index / evening) * 100) }) },
    { icon: TrendingUp, text: t("dash.tip.month", { month: monthName(cheapestMonth.month), peak: monthName(peakMonth.month) }) },
    { icon: PartyPopper, text: t("dash.tip.holiday", { pct: Math.round(ins.holidayPremiumPct) }) },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")} icon={<LayoutDashboard className="h-6 w-6" />} />

      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
          {t("dash.trending")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="trending">
          {data.trending.map((d, i) => (
            <li key={d.code}>
              <Link
                href={`/results?from=${d.from}&to=${d.code}&date=${formatDateISO(30)}&pax=1&cabin=economy`}
                className="group relative block overflow-hidden rounded-2xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <DestinationImage code={d.code} alt={city(d.code)} className="h-36 sm:h-44" sizes="(max-width: 768px) 50vw, 25vw" preload={i < 4} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="text-xs font-semibold text-emerald-300">▲ {t("dash.trendingChange", { pct: `+${Math.max(1, d.searchesChangePct)}` })}</p>
                  <p className="text-lg font-bold leading-tight">{city(d.code)}</p>
                  <p className="text-xs text-white/85">
                    {d.country}
                    {d.fare ? ` · ${t("home.popular.from", { price: formatPrice(d.fare) })}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("dash.cheapestRoutes")}</h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800" data-testid="cheapest-routes">
              {data.cheapestRoutes.map((r, i) => (
                <li key={`${r.from}${r.to}`}>
                  <Link href={`/results?from=${r.from}&to=${r.to}&date=${r.date}&pax=1&cabin=economy`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">
                        {city(r.from)} → {city(r.to)}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                    </span>
                    <span className="tabular font-bold text-emerald-700 dark:text-emerald-300">{formatPrice(r.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("dash.fareTrends")}</h2>
            <MonthlyTrendChart data={ins.monthlyAverages} />
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-950/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("dash.avgFare")} · {t("dash.domestic")}</p>
                <p className="tabular text-lg font-bold">{formatPrice(ins.avgDomesticFare)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("dash.avgFare")} · {t("dash.international")}</p>
                <p className="tabular text-lg font-bold">{formatPrice(ins.avgInternationalFare)}</p>
              </div>
            </div>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("dash.leadCurve")}</h2>
              <p className="mb-2 text-xs text-slate-500">{t("dash.leadCurve.y")}</p>
              <IndexBarChart data={lead.map((x) => ({ label: x.bucket, index: x.index }))} />
            </Card>
            <Card className="p-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("dash.dowCurve")}</h2>
              <p className="mb-2 text-xs text-slate-500">{t("dash.leadCurve.y")}</p>
              <IndexBarChart data={dow.map((x) => ({ label: weekday(x.day).slice(0, 3), index: x.index }))} />
            </Card>
          </div>
        </div>
        <Card className="h-fit p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
            {t("dash.tips")}
          </h2>
          <ul className="space-y-3" data-testid="tips">
            {tips.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            {formatNumber(data.airports)} airports · {formatNumber(data.airlines)} airlines
          </p>
        </Card>
      </div>
    </div>
  );
}

function formatDateISO(daysAhead: number) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return d.toISOString().slice(0, 10);
}
