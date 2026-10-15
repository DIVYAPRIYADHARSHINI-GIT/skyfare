"use client";
// Accessible airport combobox: type a city, code or localised name.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { AIRPORTS, getAirport } from "@/lib/sim/airports";
import { CITY_NAMES } from "@/i18n/cities";
import { useI18n } from "@/i18n";
import { inputClass } from "./ui";

export function AirportInput({
  label,
  value,
  onChange,
  invalid,
  testId,
  highlight,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  testId?: string;
  highlight?: boolean;
}) {
  const { t, city, lang } = useI18n();
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const selected = getAirport(value);
  const display = selected ? `${city(selected.code)} (${selected.code})` : "";

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = AIRPORTS.map((a) => {
      const local = CITY_NAMES[a.code]?.[lang] ?? "";
      const hay = [a.code, a.city, a.name, a.country, local].join(" ").toLowerCase();
      let score = 0;
      if (!q) score = a.popularity;
      else if (a.code.toLowerCase() === q) score = 10;
      else if (a.city.toLowerCase().startsWith(q) || local.toLowerCase().startsWith(q)) score = 5;
      else if (hay.includes(q)) score = 2;
      return { a, score };
    })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score || y.a.popularity - x.a.popularity);
    return list.slice(0, 8).map((x) => x.a);
  }, [query, lang]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={wrap} className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" aria-hidden="true" />
        <input
          id={id}
          data-testid={testId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          autoComplete="off"
          placeholder={t("search.placeholder.city")}
          className={`${inputClass} ps-9 ${highlight ? "ring-2 ring-amber-400" : ""}`}
          value={open ? query : display}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              choose(options[active].code);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Tab" && open && query && options[active]) {
              choose(options[active].code);
            }
          }}
        />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{t("search.noMatch", { q: query })}</li>}
          {options.map((a, i) => (
            <li
              key={a.code}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(a.code);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${i === active ? "bg-brand-50 dark:bg-slate-800" : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                  {city(a.code)}
                  {city(a.code) !== a.city && <span className="ms-1 text-slate-400">· {a.city}</span>}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {a.name}, {a.country}
                </span>
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{a.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
