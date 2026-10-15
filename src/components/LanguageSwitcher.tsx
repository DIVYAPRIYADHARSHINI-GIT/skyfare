"use client";
import { Languages } from "lucide-react";
import { LOCALES } from "@/i18n/config";
import { useI18n } from "@/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("nav.language")}</span>
      <Languages className="pointer-events-none absolute start-2.5 h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        data-testid="lang-switcher"
        className={`appearance-none rounded-xl border border-slate-200 bg-white py-2 ps-8 pe-3 text-sm font-medium text-slate-700 shadow-sm outline-none hover:border-brand-300 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${compact ? "max-w-[8.5rem]" : ""}`}
        aria-label={t("nav.language")}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.native}
            {l.code !== "en" ? ` · ${l.english}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
