// Server-side business logic behind the API routes. Everything is computed on
// the fly from the deterministic simulator, so there is no database.
import { AIRPORTS, type Airport, distanceKm, getAirport, nearbyAirports } from "./sim/airports.ts";
import { AIRLINES } from "./sim/airlines.ts";
import { addDays, daysInMonth, diffDays, isValidISO, todayISO } from "./sim/dates.ts";
import type { Cabin } from "./sim/fares.ts";
import { HOLIDAYS } from "./sim/holidays.ts";
import {
  cabinAvailable,
  findService,
  type Flight,
  lowestFare,
  operatesOn,
  parseFlightId,
  searchFlights,
  toFlight,
} from "./sim/schedule.ts";

export const MAX_DAYS_AHEAD = 330;

export class InputError extends Error {}

/** Re-price one flight (by id) at today's fare; throws when it no longer exists. */
export function resolveFlight(id: string, today = todayISO()): Flight {
  const p = parseFlightId(id);
  if (!p) throw new InputError("flightNotFound");
  const s = findService(p.from, p.to, p.flightNo);
  if (!s || !operatesOn(s, p.date) || !cabinAvailable(s, p.cabin)) throw new InputError("flightNotFound");
  const ahead = diffDays(p.date, today);
  if (ahead < 0 || ahead > MAX_DAYS_AHEAD) throw new InputError("flightNotFound");
  return toFlight(s, p.date, today, p.cabin);
}

export interface SearchQuery {
  from: string;
  to: string;
  date: string;
  pax: number;
  cabin: Cabin;
}

export function parseSearch(sp: URLSearchParams, today = todayISO()): SearchQuery {
  const from = (sp.get("from") ?? "").toUpperCase();
  const to = (sp.get("to") ?? "").toUpperCase();
  const date = sp.get("date") ?? "";
  const pax = Number(sp.get("pax") ?? "1");
  const cabin = (sp.get("cabin") ?? "economy") as Cabin;
  if (!getAirport(from)) throw new InputError("unknownFrom");
  if (!getAirport(to)) throw new InputError("unknownTo");
  if (from === to) throw new InputError("sameAirport");
  if (!isValidISO(date)) throw new InputError("badDate");
  if (diffDays(date, today) < 0) throw new InputError("pastDate");
  if (diffDays(date, today) > MAX_DAYS_AHEAD) throw new InputError("tooFar");
  if (!Number.isInteger(pax) || pax < 1 || pax > 9) throw new InputError("badPax");
  if (cabin !== "economy" && cabin !== "business") throw new InputError("badCabin");
  return { from, to, date, pax, cabin };
}

/** Value score: price and duration normalised against the result set (lower is better). */
export function withScores(flights: Flight[]): Array<Flight & { valueScore: number }> {
  if (!flights.length) return [];
  const minP = Math.min(...flights.map((f) => f.price));
  const minD = Math.min(...flights.map((f) => f.durationMin));
  return flights.map((f) => ({
    ...f,
    valueScore: Math.round((0.6 * (f.price / minP) + 0.4 * (f.durationMin / minD) + 0.04 * f.stops) * 1000) / 1000,
  }));
}

export function runSearch(q: SearchQuery, today = todayISO()) {
  const flights = withScores(searchFlights({ ...q, bookingDate: today }));
  const cheapest = flights.reduce<Flight | null>((m, f) => (!m || f.price < m.price ? f : m), null);
  const fastest = flights.reduce<Flight | null>((m, f) => (!m || f.durationMin < m.durationMin ? f : m), null);
  const best = flights.reduce<(Flight & { valueScore: number }) | null>((m, f) => (!m || f.valueScore < m.valueScore ? f : m), null);
  const from = getAirport(q.from)!;
  const to = getAirport(q.to)!;
  return {
    query: q,
    today,
    route: { from, to, distanceKm: distanceKm(from, to) },
    flights,
    highlights: { cheapest: cheapest?.id ?? null, fastest: fastest?.id ?? null, best: best?.id ?? null },
  };
}

export function fareCalendar(from: string, to: string, month: string, cabin: Cabin, today = todayISO()) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new InputError("badMonth");
  const [y, m] = month.split("-").map(Number);
  const n = daysInMonth(y, m);
  const days: Array<{ date: string; price: number | null; holiday: string | null; level: "low" | "mid" | "high" | null }> = [];
  for (let d = 1; d <= n; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const ahead = diffDays(date, today);
    const holiday = HOLIDAYS.find((h) => h.date === date && (!h.airports || h.airports.includes(from) || h.airports.includes(to)))?.name ?? null;
    if (ahead < 0 || ahead > MAX_DAYS_AHEAD) {
      days.push({ date, price: null, holiday, level: null });
      continue;
    }
    days.push({ date, price: lowestFare(from, to, date, today, cabin), holiday, level: null });
  }
  const priced = days.filter((d) => d.price !== null).map((d) => d.price!) as number[];
  const sorted = [...priced].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.33)] ?? 0;
  const q2 = sorted[Math.floor(sorted.length * 0.66)] ?? 0;
  for (const d of days) {
    if (d.price === null) continue;
    d.level = d.price <= q1 ? "low" : d.price <= q2 ? "mid" : "high";
  }
  const cheapestDays = days
    .filter((d) => d.price !== null)
    .sort((a, b) => a.price! - b.price!)
    .slice(0, 5)
    .map((d) => ({ date: d.date, price: d.price! }));
  return { from, to, month, cabin, days, cheapestDays, min: sorted[0] ?? null, max: sorted[sorted.length - 1] ?? null };
}

export function budgetSuggestions(q: SearchQuery, today = todayISO()) {
  const base = lowestFare(q.from, q.to, q.date, today, q.cabin);
  const nearbyDates: Array<{ date: string; price: number; saving: number }> = [];
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const d = addDays(q.date, i);
    const ahead = diffDays(d, today);
    if (ahead < 0 || ahead > MAX_DAYS_AHEAD) continue;
    const p = lowestFare(q.from, q.to, d, today, q.cabin);
    if (p !== null) nearbyDates.push({ date: d, price: p, saving: base !== null ? base - p : 0 });
  }
  nearbyDates.sort((a, b) => a.price - b.price);

  const alt: Array<{ from: string; to: string; side: "from" | "to"; airport: Airport; km: number; price: number; saving: number }> = [];
  for (const { airport, km } of nearbyAirports(q.from)) {
    if (airport.code === q.to) continue;
    const p = lowestFare(airport.code, q.to, q.date, today, q.cabin);
    if (p !== null) alt.push({ from: airport.code, to: q.to, side: "from", airport, km, price: p, saving: base !== null ? base - p : 0 });
  }
  for (const { airport, km } of nearbyAirports(q.to)) {
    if (airport.code === q.from) continue;
    const p = lowestFare(q.from, airport.code, q.date, today, q.cabin);
    if (p !== null) alt.push({ from: q.from, to: airport.code, side: "to", airport, km, price: p, saving: base !== null ? base - p : 0 });
  }
  alt.sort((a, b) => a.price - b.price);
  return { query: q, baseFare: base, nearbyDates, nearbyAirports: alt.slice(0, 6) };
}

/** Simulated daily price check for a watched route (lowest fare quoted on each day). */
export function priceHistory(from: string, to: string, date: string, cabin: Cabin, days: number, today = todayISO()) {
  const points: Array<{ date: string; price: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const quoteDay = addDays(today, -i);
    if (diffDays(date, quoteDay) < 0) continue;
    const p = lowestFare(from, to, date, quoteDay, cabin);
    if (p !== null) points.push({ date: quoteDay, price: p });
  }
  return points;
}

export interface TrackRequest {
  id: string;
  from: string;
  to: string;
  date: string;
  cabin: Cabin;
  target: number;
}

export function trackStatus(items: TrackRequest[], today = todayISO()) {
  return items.slice(0, 40).map((it) => {
    if (!getAirport(it.from) || !getAirport(it.to) || !isValidISO(it.date)) {
      return { id: it.id, error: "invalid" as const };
    }
    const departed = diffDays(it.date, today) < 0;
    const history = departed ? [] : priceHistory(it.from, it.to, it.date, it.cabin, 30, today);
    const current = history.length ? history[history.length - 1].price : null;
    const previous = history.length > 1 ? history[history.length - 2].price : null;
    const low30 = history.length ? Math.min(...history.map((h) => h.price)) : null;
    return {
      id: it.id,
      departed,
      current,
      previous,
      low30,
      belowTarget: current !== null && current <= it.target,
      history,
    };
  });
}

export function dashboardData(today = todayISO()) {
  // Cheapest fares from major Indian hubs for the coming 30 days.
  const hubs = ["DEL", "BOM", "BLR", "MAA", "HYD", "CCU"];
  const domestic: Array<{ from: string; to: string; price: number; date: string; perKm: number }> = [];
  for (const f of hubs) {
    for (const t of AIRPORTS.filter((a) => a.region === "IN" && a.code !== f)) {
      let best = Infinity;
      let bestDate = today;
      for (let i = 7; i <= 37; i += 3) {
        const d = addDays(today, i);
        const p = lowestFare(f, t.code, d, today, "economy");
        if (p !== null && p < best) {
          best = p;
          bestDate = d;
        }
      }
      if (best < Infinity) domestic.push({ from: f, to: t.code, price: best, date: bestDate, perKm: best / distanceKm(getAirport(f)!, t) });
    }
  }
  domestic.sort((a, b) => a.price - b.price);
  const seen = new Set<string>();
  const cheapestRoutes = domestic
    .filter((r) => {
      const k = [r.from, r.to].sort().join("");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8);

  // Trending destinations: demand score from popularity, season and upcoming festivals.
  const month = Number(addDays(today, 30).slice(5, 7));
  const trending = AIRPORTS.filter((a) => a.code !== "DEL")
    .map((a) => {
      const from = a.region === "IN" ? "DEL" : "BOM";
      const fare = lowestFare(from, a.code, addDays(today, 30), today, "economy");
      const seasonBoost = a.kind === "beach" && [11, 12, 1, 2].includes(month) ? 0.25 : a.kind === "hill" && [4, 5, 6].includes(month) ? 0.2 : 0;
      const festival = HOLIDAYS.some((h) => {
        const dd = diffDays(h.date, today);
        return dd >= 0 && dd <= 45 && h.airports?.includes(a.code);
      })
        ? 0.15
        : 0;
      const wiggle = (((a.code.charCodeAt(0) * 7 + a.code.charCodeAt(2) * 13 + Number(today.slice(8))) % 17) - 8) / 100;
      const score = a.popularity + seasonBoost + festival + wiggle;
      return { code: a.code, city: a.city, country: a.country, from, fare, score: Math.round(score * 100), searchesChangePct: Math.round((seasonBoost + festival + wiggle) * 100 + 6) };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 8);

  return { today, cheapestRoutes, trending, airlines: AIRLINES.length, airports: AIRPORTS.length };
}

export function bookingReference(seed: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[(h >>> 0) % chars.length];
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  }
  return out;
}
