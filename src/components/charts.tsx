"use client";
// Recharts wrappers with theme-aware colours and localised tick labels.
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n";

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function useChartColors() {
  const dark = useDark();
  return {
    grid: dark ? "#1e293b" : "#e2e8f0",
    axis: dark ? "#94a3b8" : "#64748b",
    brand: dark ? "#52b6fc" : "#1479ed",
    brandFill: dark ? "#1479ed" : "#89d1ff",
    green: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
    violet: "#8b5cf6",
    tooltipBg: dark ? "#0f172a" : "#ffffff",
    tooltipBorder: dark ? "#334155" : "#e2e8f0",
    text: dark ? "#e2e8f0" : "#0f172a",
  };
}

function tooltipStyle(c: ReturnType<typeof useChartColors>) {
  return {
    contentStyle: { background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 12, fontSize: 12, color: c.text },
    labelStyle: { color: c.text, fontWeight: 600 },
  };
}

function compactPrice(formatNumber: (n: number, d?: number) => string) {
  return (v: number) => (v >= 100000 ? `₹${formatNumber(Math.round(v / 1000))}k` : v >= 1000 ? `₹${formatNumber(Math.round(v / 100) / 10, 1)}k` : `₹${formatNumber(v)}`);
}

export interface ForecastDatum {
  bookingDate: string;
  predicted: number;
  low: number;
  high: number;
}

export function ForecastChart({ data, best, height = 300 }: { data: ForecastDatum[]; best?: ForecastDatum; height?: number }) {
  const { t, formatPrice, formatDate, formatNumber, info } = useI18n();
  const c = useChartColors();
  const rows = data.map((d) => ({ ...d, range: [d.low, d.high] as [number, number] }));
  return (
    <div style={{ height }} dir="ltr" data-testid="forecast-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fc-range" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.brandFill} stopOpacity={0.45} />
              <stop offset="1" stopColor={c.brandFill} stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="bookingDate" tick={{ fill: c.axis }} tickFormatter={(d) => formatDate(d, { day: "numeric", month: "short" })} minTickGap={24} reversed={info.dir === "rtl"} />
          <YAxis tick={{ fill: c.axis }} tickFormatter={compactPrice(formatNumber)} width={58} domain={["auto", "auto"]} orientation={info.dir === "rtl" ? "right" : "left"} />
          <Tooltip
            {...tooltipStyle(c)}
            labelFormatter={(d) => `${t("predict.chart.bookingDay")}: ${formatDate(String(d), { weekday: "short", day: "numeric", month: "short" })}`}
            formatter={(v, name) => (Array.isArray(v) ? [`${formatPrice(v[0])} – ${formatPrice(v[1])}`, t("predict.chart.range")] : [formatPrice(Number(v)), name === "predicted" ? t("predict.chart.predicted") : String(name)])}
          />
          <Area type="monotone" dataKey="range" stroke="none" fill="url(#fc-range)" name={t("predict.chart.range")} isAnimationActive={false} />
          <Line type="monotone" dataKey="predicted" stroke={c.brand} strokeWidth={2.5} dot={false} name="predicted" isAnimationActive={false} />
          {best && <ReferenceDot x={best.bookingDate} y={best.predicted} r={6} fill={c.green} stroke="#fff" strokeWidth={2} />}
          <ReferenceLine x={data[0]?.bookingDate} stroke={c.amber} strokeDasharray="4 4" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TravelDateChart({ data, selected, height = 220, onSelect }: { data: Array<{ date: string; predicted: number }>; selected: string; height?: number; onSelect?: (d: string) => void }) {
  const { formatPrice, formatDate, formatNumber, t, info } = useI18n();
  const c = useChartColors();
  const min = Math.min(...data.map((d) => d.predicted));
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} onClick={(s) => s?.activeLabel && onSelect?.(String(s.activeLabel))}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: c.axis }} tickFormatter={(d) => formatDate(d, { day: "numeric", month: "short" })} minTickGap={20} reversed={info.dir === "rtl"} />
          <YAxis tick={{ fill: c.axis }} tickFormatter={compactPrice(formatNumber)} width={58} orientation={info.dir === "rtl" ? "right" : "left"} />
          <Tooltip {...tooltipStyle(c)} labelFormatter={(d) => formatDate(String(d), { weekday: "long", day: "numeric", month: "short" })} formatter={(v) => [formatPrice(Number(v)), t("predict.chart.predicted")]} cursor={{ fill: c.grid }} />
          <Bar dataKey="predicted" radius={[4, 4, 0, 0]} isAnimationActive={false} style={{ cursor: onSelect ? "pointer" : undefined }}>
            {data.map((d) => (
              <Cell key={d.date} fill={d.date === selected ? c.violet : d.predicted <= min * 1.04 ? c.green : c.brandFill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceHistoryChart({ data, target, height = 160 }: { data: Array<{ date: string; price: number }>; target?: number; height?: number }) {
  const { formatPrice, formatDate, formatNumber, t, info } = useI18n();
  const c = useChartColors();
  const values = data.map((d) => d.price).concat(target ? [target] : []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(200, (hi - lo) * 0.15);
  return (
    <div style={{ height }} dir="ltr" data-testid="history-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ph-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.brandFill} stopOpacity={0.5} />
              <stop offset="1" stopColor={c.brandFill} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: c.axis }} tickFormatter={(d) => formatDate(d, { day: "numeric", month: "short" })} minTickGap={28} reversed={info.dir === "rtl"} />
          <YAxis tick={{ fill: c.axis }} tickFormatter={compactPrice(formatNumber)} width={54} domain={[Math.max(0, lo - pad), hi + pad]} orientation={info.dir === "rtl" ? "right" : "left"} />
          <Tooltip {...tooltipStyle(c)} labelFormatter={(d) => formatDate(String(d))} formatter={(v) => [formatPrice(Number(v)), t("watch.current")]} />
          {target ? <ReferenceLine y={target} stroke={c.green} strokeDasharray="5 4" label={{ value: t("watch.target"), fill: c.green, fontSize: 11, position: "insideTopLeft" }} /> : null}
          <Area type="monotone" dataKey="price" stroke={c.brand} strokeWidth={2} fill="url(#ph-fill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyTrendChart({ data, height = 260 }: { data: Array<{ month: string; domestic: number; international: number }>; height?: number }) {
  const { t, formatPrice, formatNumber, info } = useI18n();
  const c = useChartColors();
  const fmtMonth = (m: string) => new Intl.DateTimeFormat(info.intl, { month: "short", timeZone: "UTC" }).format(new Date(`${m}-15T00:00:00Z`));
  return (
    <div style={{ height }} dir="ltr" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: c.axis }} tickFormatter={fmtMonth} reversed={info.dir === "rtl"} />
          <YAxis yAxisId="d" tick={{ fill: c.axis }} tickFormatter={compactPrice(formatNumber)} width={54} orientation={info.dir === "rtl" ? "right" : "left"} />
          <YAxis yAxisId="i" tick={{ fill: c.axis }} tickFormatter={compactPrice(formatNumber)} width={54} orientation={info.dir === "rtl" ? "left" : "right"} />
          <Tooltip {...tooltipStyle(c)} labelFormatter={(m) => fmtMonth(String(m))} formatter={(v, name) => [formatPrice(Number(v)), name === "domestic" ? t("dash.domestic") : t("dash.international")]} />
          <Legend formatter={(v) => (v === "domestic" ? t("dash.domestic") : t("dash.international"))} />
          <Line yAxisId="d" type="monotone" dataKey="domestic" stroke={c.brand} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line yAxisId="i" type="monotone" dataKey="international" stroke={c.amber} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IndexBarChart({ data, height = 200, highlightMin = true }: { data: Array<{ label: string; index: number }>; height?: number; highlightMin?: boolean }) {
  const { t, formatNumber, info } = useI18n();
  const c = useChartColors();
  const min = Math.min(...data.map((d) => d.index));
  const max = Math.max(...data.map((d) => d.index));
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.axis }} interval={0} reversed={info.dir === "rtl"} />
          <YAxis tick={{ fill: c.axis }} domain={[Math.floor(min * 10) / 10 - 0.1, Math.ceil(max * 10) / 10]} width={36} tickFormatter={(v) => formatNumber(v, 1)} orientation={info.dir === "rtl" ? "right" : "left"} />
          <ReferenceLine y={1} stroke={c.axis} strokeDasharray="3 3" />
          <Tooltip {...tooltipStyle(c)} formatter={(v) => [formatNumber(Number(v), 2), t("dash.priceIndex")]} cursor={{ fill: c.grid }} />
          <Bar dataKey="index" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={highlightMin && d.index === min ? c.green : d.index === max ? c.rose : c.brandFill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ImportanceChart({ data, height = 300 }: { data: Array<{ label: string; importance: number }>; height?: number }) {
  const { formatNumber } = useI18n();
  const c = useChartColors();
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: c.axis }} tickFormatter={(v) => `${formatNumber(v * 100)}%`} />
          <YAxis type="category" dataKey="label" tick={{ fill: c.axis }} width={150} />
          <Tooltip {...tooltipStyle(c)} formatter={(v) => [`${formatNumber(Number(v) * 100, 1)}%`, ""]} cursor={{ fill: c.grid }} />
          <Bar dataKey="importance" fill={c.brand} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScatterFit({ data, height = 300 }: { data: Array<{ actual: number; predicted: number }>; height?: number }) {
  const { t, formatPrice, formatNumber } = useI18n();
  const c = useChartColors();
  const max = Math.max(...data.map((d) => Math.max(d.actual, d.predicted)));
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={c.grid} />
          <XAxis type="number" dataKey="actual" name={t("about.actual")} tick={{ fill: c.axis }} tickFormatter={compactPrice(formatNumber)} domain={[0, max]} scale="sqrt" />
          <YAxis type="number" dataKey="predicted" name={t("about.predicted")} tick={{ fill: c.axis }} tickFormatter={compactPrice(formatNumber)} domain={[0, max]} scale="sqrt" width={58} />
          <Tooltip {...tooltipStyle(c)} formatter={(v, n) => [formatPrice(Number(v)), String(n)]} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: max, y: max }]} stroke={c.amber} strokeDasharray="4 4" />
          <Scatter data={data} fill={c.brand} fillOpacity={0.45} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
