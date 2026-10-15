"use client";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { Logo } from "./NavBar";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-slate-400">
        <Logo />
        <p className="max-w-xl">{t("app.demo")}</p>
        <nav className="flex gap-4" aria-label="Footer">
          <Link className="hover:text-brand-600" href="/about">
            {t("nav.about")}
          </Link>
          <Link className="hover:text-brand-600" href="/about#credits">
            {t("about.credits")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
