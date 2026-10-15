"use client";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, BellRing, PiggyBank, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import { SearchForm } from "@/components/SearchForm";
import { Card } from "@/components/ui";
import { DestinationImage } from "@/components/DestinationImage";
import { PlaneIcon } from "@/components/illustrations";
import { addDays, todayISO } from "@/lib/sim/dates";

const POPULAR: Array<[string, string]> = [
  ["DEL", "BOM"],
  ["BLR", "GOI"],
  ["MAA", "DXB"],
  ["BOM", "SIN"],
  ["HYD", "JAI"],
  ["DEL", "LHR"],
];

export function HomeView() {
  const { t, city } = useI18n();
  const date = addDays(todayISO(), 21);
  const features = [
    { icon: SlidersHorizontal, title: t("home.feature.search.title"), body: t("home.feature.search.body"), href: "/" },
    { icon: PiggyBank, title: t("home.feature.budget.title"), body: t("home.feature.budget.body"), href: "/budget" },
    { icon: BarChart3, title: t("home.feature.predict.title"), body: t("home.feature.predict.body"), href: "/predict" },
    { icon: BellRing, title: t("home.feature.track.title"), body: t("home.feature.track.body"), href: "/watchlist" },
  ];
  return (
    <>
      {/* Hero with airplane-wing photo (Unsplash, Ross Parmly) */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/images/hero/sky-wing.jpg"
          alt="Airplane wing above the clouds at sunrise"
          fill
          preload
          sizes="100vw"
          quality={75}
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-950/70 via-brand-900/45 to-sky-50 dark:to-slate-950" />
        <div className="pointer-events-none absolute top-24 -z-10 flex w-[200%] animate-drift gap-40 opacity-50" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <PlaneIcon key={i} className="rtl-flip h-5 w-10 text-white/70" />
          ))}
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
          <div className="max-w-3xl text-white">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ring-white/25 backdrop-blur">
              <PlaneIcon className="rtl-flip h-3 w-6" /> {t("app.tagline")}
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight drop-shadow sm:text-5xl">{t("home.hero.title")}</h1>
            <p className="mt-4 max-w-2xl text-base text-white/90 drop-shadow sm:text-lg">{t("home.hero.subtitle")}</p>
          </div>
          <Card className="mt-8 p-4 shadow-2xl shadow-brand-950/20 sm:p-6">
            <SearchForm />
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="mb-4 mt-6 text-xl font-bold text-slate-900 dark:text-white">{t("home.popular")}</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {POPULAR.map(([from, to]) => (
            <li key={`${from}${to}`}>
              <Link
                href={`/results?from=${from}&to=${to}&date=${date}&pax=1&cabin=economy`}
                className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <DestinationImage code={to} alt={city(to)} className="h-24 sm:h-28" sizes="(max-width: 768px) 50vw, 16vw" showCredit={false} />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {city(from)} → {city(to)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {from} - {to}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mb-4 mt-12 text-xl font-bold text-slate-900 dark:text-white">{t("home.features.title")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body, href }) => (
            <Link key={title} href={href} className="group">
              <Card className="h-full p-5 transition group-hover:border-brand-300 group-hover:shadow-md">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
