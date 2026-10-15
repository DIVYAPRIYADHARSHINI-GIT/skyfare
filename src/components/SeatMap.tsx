"use client";
import { Armchair } from "lucide-react";
import { useI18n } from "@/i18n";
import type { SeatMap as SeatMapT } from "@/lib/booking";

export function SeatMap({
  map,
  assigned,
  activeIndex,
  onPick,
}: {
  map: SeatMapT;
  /** seat id -> passenger index */
  assigned: Record<string, number>;
  activeIndex: number;
  onPick: (seatId: string) => void;
}) {
  const { t, formatPrice } = useI18n();
  return (
    <div className="overflow-x-auto" dir="ltr">
      <div className="mx-auto w-fit rounded-[2.5rem] border-2 border-slate-200 bg-white px-4 pb-6 pt-10 shadow-inner dark:border-slate-700 dark:bg-slate-950" data-testid="seat-map">
        <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400">▲ {t("book.seat.front")}</p>
        <div className="mb-2 flex justify-center gap-1.5 ps-8">
          {map.letters.map((l, i) => (
            <span key={l} className={`w-9 text-center text-xs font-bold text-slate-400 ${map.aisleAfter.includes(i) ? "me-6" : ""}`}>
              {l}
            </span>
          ))}
        </div>
        <div className="space-y-1.5">
          {map.rows.map((row) => (
            <div key={row.row} className="flex items-center gap-1.5">
              <span className="w-6 text-end text-xs font-semibold text-slate-400">{row.row}</span>
              <span className="w-1" />
              {row.seats.map((s, i) => {
                const pax = assigned[s.id];
                const mine = pax !== undefined;
                const isActive = pax === activeIndex;
                const label = `${s.id} · ${t(`book.seat.${s.kind}` as "book.seat.window")}${s.extraLegroom ? ` · ${t("book.seat.legroom")}` : ""} · ${s.taken ? t("book.seat.taken") : s.price ? formatPrice(s.price) : t("book.seat.free")}`;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={s.taken && !mine}
                    onClick={() => onPick(s.id)}
                    title={label}
                    aria-label={label}
                    aria-pressed={mine}
                    data-testid={`seat-${s.id}`}
                    data-taken={s.taken ? "1" : "0"}
                    className={`relative grid h-9 w-9 place-items-center rounded-t-lg rounded-b-sm text-[10px] font-bold transition ${map.aisleAfter.includes(i) ? "me-6" : ""} ${
                      s.taken && !mine
                        ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                        : mine
                          ? isActive
                            ? "bg-brand-600 text-white ring-2 ring-brand-300"
                            : "bg-brand-400 text-white"
                          : s.extraLegroom
                            ? "bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-200"
                            : s.price
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200"
                              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200"
                    }`}
                  >
                    {mine ? pax + 1 : s.taken ? "×" : <Armchair className="h-4 w-4 opacity-70" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-800" />{t("book.seat.free")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-800" />{t("book.seat.available")} (₹)</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-violet-200 dark:bg-violet-800" />{t("book.seat.legroom")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand-500" />{t("book.seat.selected")}</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-300 dark:bg-slate-700" />{t("book.seat.taken")}</span>
      </div>
    </div>
  );
}
