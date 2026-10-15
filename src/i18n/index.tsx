"use client";
// i18n runtime: language provider, t() with {placeholder} interpolation,
// English fallback, localStorage persistence and <html lang/dir> updates.
// English is bundled; other languages are code-split and loaded on demand.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en, { type MessageKey, type Messages } from "./messages/en";
import { cityName } from "./cities";
import { DEFAULT_LOCALE, LOCALE_CODES, LOCALE_STORAGE_KEY, localeInfo, type LocaleInfo } from "./config";
import { getAirport } from "@/lib/sim/airports";

const MESSAGE_LOADERS: Record<string, () => Promise<{ default: Messages }>> = {
  en: async () => ({ default: en }),
  ta: () => import("./messages/ta"),
  hi: () => import("./messages/hi"),
  te: () => import("./messages/te"),
  kn: () => import("./messages/kn"),
  ml: () => import("./messages/ml"),
  bn: () => import("./messages/bn"),
  mr: () => import("./messages/mr"),
  es: () => import("./messages/es"),
  fr: () => import("./messages/fr"),
  ar: () => import("./messages/ar"),
};

export type TParams = Record<string, string | number>;

export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

interface I18nValue {
  lang: string;
  info: LocaleInfo;
  ready: boolean;
  setLang: (code: string) => void;
  t: (key: MessageKey, params?: TParams) => string;
  /** Translate a key coming from the API (e.g. prediction reasons). */
  tk: (key: string, params?: TParams) => string;
  formatPrice: (inr: number) => string;
  formatNumber: (n: number, digits?: number) => string;
  formatDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  formatDuration: (min: number) => string;
  city: (code: string) => string;
  weekday: (dayIdxMon0: number) => string;
  monthName: (month1: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLang(): string {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v && LOCALE_CODES.includes(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages>(en);
  const [ready, setReady] = useState(false);

  // Restore the saved language after hydration.
  useEffect(() => {
    const stored = readStoredLang();
    if (stored !== DEFAULT_LOCALE) setLangState(stored);
    else setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const info = localeInfo(lang);
    document.documentElement.lang = info.code;
    document.documentElement.dir = info.dir;
    MESSAGE_LOADERS[lang]?.()
      .then((m) => {
        if (!cancelled) {
          setMessages(m.default);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages(en);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((code: string) => {
    if (!LOCALE_CODES.includes(code)) return;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    setLangState(code);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const info = localeInfo(lang);
    const t = (key: MessageKey, params?: TParams) => interpolate(messages[key] ?? en[key] ?? key, params);
    const tk = (key: string, params?: TParams) => t(key as MessageKey, params);
    const nf0 = new Intl.NumberFormat(info.intl, { maximumFractionDigits: 0 });
    const cur = new Intl.NumberFormat(info.intl, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    return {
      lang,
      info,
      ready,
      setLang,
      t,
      tk,
      formatPrice: (inr) => cur.format(Math.round(inr)),
      formatNumber: (n, digits = 0) =>
        digits ? new Intl.NumberFormat(info.intl, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n) : nf0.format(n),
      formatDate: (iso, opts = { day: "numeric", month: "short", year: "numeric" }) =>
        new Intl.DateTimeFormat(info.intl, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`)),
      formatDuration: (min) => t("common.hoursMinutes", { h: Math.floor(min / 60), m: String(min % 60).padStart(2, "0") }),
      city: (code) => {
        const a = getAirport(code);
        return a ? cityName(a.code, a.city, lang) : code;
      },
      weekday: (d) =>
        new Intl.DateTimeFormat(info.intl, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + d))),
      monthName: (m) => new Intl.DateTimeFormat(info.intl, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, m - 1, 15))),
    };
  }, [lang, messages, ready, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
