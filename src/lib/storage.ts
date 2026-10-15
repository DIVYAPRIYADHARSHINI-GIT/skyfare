"use client";
// localStorage-backed stores (watchlist, bookings, alerts, last search).
// No database: everything lives in the user's browser. A tiny pub/sub keeps
// every component (nav badge, pages, alert banner) in sync, including across tabs.
import { useCallback, useSyncExternalStore } from "react";
import type { Flight } from "./sim/schedule";
import type { PriceSummary } from "./booking";

export interface WatchItem {
  id: string;
  from: string;
  to: string;
  date: string;
  cabin: "economy" | "business";
  target: number;
  createdAt: string;
  /** Last simulated check result (cached for My trips and alerts). */
  lastPrice?: number;
  lastChecked?: string;
  alertedAt?: string;
}

export interface Booking {
  ref: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
  flight: Flight;
  passengers: Array<{ title: string; firstName: string; lastName: string; age: number; gender: string; seat: string | null; meal: boolean; bag: string }>;
  contact: { email: string; phone: string };
  extras: { priority: boolean; insurance: boolean };
  payment: { method: "card" | "upi"; last4?: string; upiId?: string };
  summary: PriceSummary;
  gate: string;
}

export interface PriceAlert {
  id: string;
  watchId: string;
  from: string;
  to: string;
  date: string;
  price: number;
  target: number;
  createdAt: string;
  dismissed?: boolean;
}

const KEYS = {
  watchlist: "skyfare.watchlist",
  bookings: "skyfare.bookings",
  alerts: "skyfare.alerts",
  lastSearch: "skyfare.lastSearch",
  theme: "skyfare.theme",
} as const;

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  const c = cache.get(key);
  if (c && c.raw === raw) return c.value as T;
  let value: T = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function write<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
  } catch {
    /* quota or privacy mode - keep in memory only */
  }
  cache.set(key, { raw, value });
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, l: Listener) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.get(key)?.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: never[] = [];

function useStored<T>(key: string, fallback: T): [T, (updater: (prev: T) => T) => void] {
  const value = useSyncExternalStore(
    (l) => subscribe(key, l),
    () => read(key, fallback),
    () => fallback,
  );
  const update = useCallback((updater: (prev: T) => T) => write(key, updater(read(key, fallback))), [key, fallback]);
  return [value, update];
}

export function useWatchlist() {
  return useStored<WatchItem[]>(KEYS.watchlist, EMPTY as WatchItem[]);
}
export function useBookings() {
  return useStored<Booking[]>(KEYS.bookings, EMPTY as Booking[]);
}
export function useAlerts() {
  return useStored<PriceAlert[]>(KEYS.alerts, EMPTY as PriceAlert[]);
}

export function watchId(from: string, to: string, date: string, cabin: string) {
  return `${from}-${to}-${date}-${cabin}`;
}

export const MAX_WATCH = 20;

export function addWatch(item: Omit<WatchItem, "id" | "createdAt">): "added" | "exists" | "full" {
  const list = read<WatchItem[]>(KEYS.watchlist, []);
  const id = watchId(item.from, item.to, item.date, item.cabin);
  if (list.some((w) => w.id === id)) return "exists";
  if (list.length >= MAX_WATCH) return "full";
  write(KEYS.watchlist, [...list, { ...item, id, createdAt: new Date().toISOString() }]);
  return "added";
}

export function saveBooking(b: Booking) {
  const list = read<Booking[]>(KEYS.bookings, []);
  write(KEYS.bookings, [b, ...list.filter((x) => x.ref !== b.ref)]);
}

export function getBooking(ref: string): Booking | undefined {
  return read<Booking[]>(KEYS.bookings, []).find((b) => b.ref === ref);
}

export interface LastSearch {
  from: string;
  to: string;
  date: string;
  pax: number;
  cabin: "economy" | "business";
}

export function saveLastSearch(s: LastSearch) {
  write(KEYS.lastSearch, s);
}
export function readLastSearch(): LastSearch | null {
  return read<LastSearch | null>(KEYS.lastSearch, null);
}

/** Records watch results and raises an alert the first time a fare drops below target. */
export function applyTrackResults(results: Array<{ id: string; current: number | null; belowTarget?: boolean }>, today: string) {
  const list = read<WatchItem[]>(KEYS.watchlist, []);
  const alerts = read<PriceAlert[]>(KEYS.alerts, []);
  const newAlerts: PriceAlert[] = [];
  const now = new Date().toISOString();
  const updated = list.map((w) => {
    const r = results.find((x) => x.id === w.id);
    if (!r || r.current === null) return w;
    const next: WatchItem = { ...w, lastPrice: r.current, lastChecked: now };
    if (r.belowTarget) {
      // one alert per watch per day
      const already = alerts.some((a) => a.watchId === w.id && a.createdAt.slice(0, 10) === today);
      if (!already) {
        newAlerts.push({ id: `${w.id}-${today}`, watchId: w.id, from: w.from, to: w.to, date: w.date, price: r.current, target: w.target, createdAt: now });
        next.alertedAt = now;
      }
    }
    return next;
  });
  write(KEYS.watchlist, updated);
  if (newAlerts.length) write(KEYS.alerts, [...newAlerts, ...alerts].slice(0, 50));
  return newAlerts;
}

export function dismissAlert(id: string) {
  const alerts = read<PriceAlert[]>(KEYS.alerts, []);
  write(KEYS.alerts, alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
}

export { KEYS as STORAGE_KEYS };
