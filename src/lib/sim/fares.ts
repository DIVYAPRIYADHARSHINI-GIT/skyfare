// The fare model behind SkyFare's simulated world.
// price = route base fare x airline x booking lead time x day of week
//         x time of day x season x holiday demand x stops x cabin x noise
// The same function generates the 12-month training history
// (scripts/generate-data.ts) and prices live search results, so the ML model
// learns exactly the patterns the app later shows.
import { type Airport, distanceKm, isDomestic } from "./airports.ts";
import { HOLIDAYS } from "./holidays.ts";
import { dayOfWeek, monthOf, parseISO } from "./dates.ts";
import { rand01, randNormal } from "./rng.ts";

export type Cabin = "economy" | "business";
export type TimeBucket = "early" | "morning" | "afternoon" | "evening" | "night";
export const TIME_BUCKETS: TimeBucket[] = ["early", "morning", "afternoon", "evening", "night"];

const DAY_MS = 86_400_000;

export function isLongHaul(a: Airport, b: Airport): boolean {
  const far = ["EU", "NA"];
  return (far.includes(a.region) || far.includes(b.region)) && distanceKm(a, b) > 4500;
}

/** Economy base fare in INR before demand multipliers. */
export function baseEconomyFare(a: Airport, b: Airport): number {
  const km = distanceKm(a, b);
  if (isDomestic(a, b)) return 1450 + 3.35 * km;
  if (!isLongHaul(a, b)) return 4600 + 3.3 * km;
  return 9000 + 4.4 * km;
}

export function timeBucket(depMin: number): TimeBucket {
  const h = Math.floor((((depMin % 1440) + 1440) % 1440) / 60);
  if (h >= 5 && h < 7) return "early";
  if (h >= 7 && h < 11) return "morning";
  if (h >= 11 && h < 16) return "afternoon";
  if (h >= 16 && h < 22) return "evening";
  return "night";
}

/** Early-morning and red-eye flights are cheaper; business-friendly banks cost more. */
export const TOD_FACTOR: Record<TimeBucket, number> = {
  early: 0.9,
  morning: 1.08,
  afternoon: 0.98,
  evening: 1.1,
  night: 0.86,
};

/** Monday..Sunday. Friday and Sunday departures spike, Tue/Wed are cheapest. */
export const DOW_FACTOR = [1.0, 0.94, 0.93, 0.98, 1.1, 1.04, 1.12];

/**
 * Booking-curve multiplier by days before departure: cheapest 3-8 weeks out,
 * climbing steeply inside two weeks (last-minute fares can be ~1.9x).
 */
export function leadFactor(daysBefore: number): number {
  const d = Math.max(0, daysBefore);
  const v = 0.93 + 0.85 * Math.exp(-d / 6) + 0.18 * Math.exp(-d / 18) + 0.0014 * Math.max(0, d - 60);
  return Math.min(v, 1.06 + 0.85 * Math.exp(-d / 6));
}

// Jan..Dec demand. India peaks: Dec-Jan holidays, May-Jun summer vacation,
// Oct-Nov festivals; monsoon (Jul-Sep) is the low season.
const SEASON_BASE = [1.08, 0.94, 0.95, 1.0, 1.12, 1.1, 0.88, 0.9, 0.92, 1.03, 1.06, 1.15];
const SEASON_BEACH = [0.1, 0.06, 0, -0.04, -0.06, -0.12, -0.15, -0.14, -0.1, 0, 0.06, 0.12];
const SEASON_HILL = [-0.04, -0.04, 0, 0.06, 0.1, 0.06, -0.04, -0.04, 0, 0.02, 0, -0.02];
const SEASON_LONGHAUL = [-0.06, -0.08, -0.04, 0, 0.04, 0.12, 0.14, 0.1, -0.02, -0.04, -0.04, 0.08];
const SEASON_GULF = [0.04, 0, 0, 0.03, 0, 0.06, 0.1, 0.06, 0, 0, 0, 0.06];

export function seasonFactor(month1: number, from: Airport, to: Airport): number {
  const m = month1 - 1;
  let f = SEASON_BASE[m];
  if (to.kind === "beach") f += SEASON_BEACH[m];
  if (to.kind === "hill") f += SEASON_HILL[m];
  if (isLongHaul(from, to)) f += SEASON_LONGHAUL[m];
  if (to.region === "ME" || from.region === "ME") f += SEASON_GULF[m];
  return f;
}

// Holidays pre-parsed to epoch days for speed.
const HOLIDAY_DAYS = HOLIDAYS.map((h) => ({ ...h, day: Math.round(parseISO(h.date) / DAY_MS) }));

export interface HolidayEffect {
  uplift: number;
  name: string | null;
  /** Signed days from departure to the holiday (positive = holiday is after departure). */
  daysToHoliday: number | null;
  /** Calendar importance of that holiday (0 when none is near). */
  importance: number;
}

/**
 * Demand uplift around festivals: the outbound rush builds in the 4 days
 * before a holiday, a smaller return rush follows it. Regional festivals only
 * affect their cities.
 */
export function holidayEffect(depDate: string, from: string, to: string): HolidayEffect {
  const day = Math.round(parseISO(depDate) / DAY_MS);
  let best: HolidayEffect = { uplift: 0, name: null, daysToHoliday: null, importance: 0 };
  for (const h of HOLIDAY_DAYS) {
    const delta = h.day - day;
    if (delta < -4 || delta > 4) continue;
    if (h.airports && !h.airports.includes(from) && !h.airports.includes(to)) continue;
    const k = delta >= 0 ? 1 - delta / 5 : 0.55 * (1 + (delta + 1) / 3.2);
    const u = h.weight * Math.max(0, k);
    if (u > best.uplift) best = { uplift: u, name: h.name, daysToHoliday: delta, importance: h.weight };
  }
  return best;
}

export function cabinFactor(cabin: Cabin, a: Airport, b: Airport): number {
  if (cabin === "economy") return 1;
  if (isDomestic(a, b)) return 2.7;
  return isLongHaul(a, b) ? 3.4 : 3.0;
}

export interface PriceInput {
  from: Airport;
  to: Airport;
  depDate: string;
  bookingDate: string;
  daysBefore: number;
  /** Departure minute of day (origin local time). */
  depMin: number;
  airlineFactor: number;
  stopsFactor: number;
  cabin: Cabin;
  /** Identifies the flight for its persistent and daily noise. */
  noiseKey: string;
}

export interface PriceBreakdown {
  price: number;
  base: number;
  lead: number;
  dow: number;
  tod: number;
  season: number;
  holiday: HolidayEffect;
  market: number;
}

/** Route-wide fare sale or surge for a given booking day (shared by all flights). */
export function marketShock(routeKey: string, depDate: string, bookingDate: string): number {
  const r = rand01("shock", routeKey, bookingDate);
  if (r < 0.035) return 0.85; // flash sale
  if (r > 0.975) return 1.1; // demand surge
  // slow-moving week-level market drift per departure date
  const week = Math.floor(parseISO(bookingDate) / (7 * DAY_MS));
  return Math.exp(0.025 * randNormal("drift", routeKey, depDate, week));
}

export function priceBreakdown(p: PriceInput): PriceBreakdown {
  const base = baseEconomyFare(p.from, p.to);
  const lead = leadFactor(p.daysBefore);
  const dow = DOW_FACTOR[dayOfWeek(p.depDate)];
  const tod = TOD_FACTOR[timeBucket(p.depMin)];
  const season = seasonFactor(monthOf(p.depDate), p.from, p.to);
  const holiday = holidayEffect(p.depDate, p.from.code, p.to.code);
  const routeKey = `${p.from.code}${p.to.code}`;
  const market = marketShock(routeKey, p.depDate, p.bookingDate);
  // Persistent per flight/date noise (how full that flight is) + daily jitter.
  const persistent = Math.exp(0.045 * randNormal("pf", p.noiseKey, p.depDate));
  const daily = Math.exp(0.03 * randNormal("df", p.noiseKey, p.depDate, p.bookingDate));
  const price =
    base *
    p.airlineFactor *
    lead *
    dow *
    tod *
    season *
    (1 + holiday.uplift) *
    p.stopsFactor *
    cabinFactor(p.cabin, p.from, p.to) *
    market *
    persistent *
    daily;
  return { price: Math.max(899, Math.round(price)), base, lead, dow, tod, season, holiday, market };
}

export function priceFor(p: PriceInput): number {
  return priceBreakdown(p).price;
}
