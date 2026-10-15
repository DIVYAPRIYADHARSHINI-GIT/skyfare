// Deterministic flight schedules for any airport pair.
// Each pair gets a stable set of services (flight number, departure time,
// stops, operating weekdays) per airline, and each service is priced per
// travel date + booking date by the fare model in fares.ts.
import { type Airport, distanceKm, getAirport, isDomestic } from "./airports.ts";
import { type Airline, AIRLINES, getAirline } from "./airlines.ts";
import { addDays, dayOfWeek, diffDays } from "./dates.ts";
import { type Cabin, isLongHaul, priceFor, TIME_BUCKETS, type TimeBucket, timeBucket } from "./fares.ts";
import { hashString, rand01, randInt } from "./rng.ts";

export interface Leg {
  from: string;
  to: string;
  /** Minutes after the journey's departure (origin local) that this leg departs. */
  offsetMin: number;
  durationMin: number;
}

export interface Service {
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  /** Departure, minutes after local midnight at the origin. */
  depMin: number;
  durationMin: number;
  stops: number;
  via: string[];
  legs: Leg[];
  /** Bitmask of operating weekdays (bit 0 = Monday). */
  days: number;
  aircraft: string;
}

export interface Flight {
  id: string;
  airline: string;
  airlineName: string;
  flightNo: string;
  from: string;
  to: string;
  date: string;
  depTime: string;
  arrTime: string;
  /** Days the arrival is after the departure date (local times). */
  arrDayOffset: number;
  depMin: number;
  durationMin: number;
  stops: number;
  via: string[];
  layoverMin: number[];
  cabin: Cabin;
  price: number;
  seatsLeft: number;
  aircraft: string;
  timeBucket: TimeBucket;
  daysBefore: number;
}

const ALL_DAYS = 0b1111111;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`;
}

function covers(al: Airline, region: string): boolean {
  return al.home === region || al.serves.includes(region as Airline["home"]);
}

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function legDuration(a: Airport, b: Airport): number {
  const km = distanceKm(a, b);
  return round5(32 + (km / 790) * 60 + (km > 4000 ? 15 : 0));
}

const BUCKET_WEIGHTS: Array<[TimeBucket, number, number, number]> = [
  // bucket, weight, start minute, span minutes
  ["early", 0.15, 5 * 60, 120],
  ["morning", 0.27, 7 * 60, 240],
  ["afternoon", 0.2, 11 * 60, 300],
  ["evening", 0.26, 16 * 60, 360],
  ["night", 0.12, 22 * 60, 420],
];

function pickDepMin(seed: string): number {
  const r = rand01("bucket", seed);
  let acc = 0;
  for (const [, w, start, span] of BUCKET_WEIGHTS) {
    acc += w;
    if (r <= acc) return round5(start + rand01("min", seed) * (span - 5)) % 1440;
  }
  return 6 * 60;
}

function aircraftFor(al: Airline, km: number, seed: string): string {
  if (km > 4500) return ["Boeing 787-9", "Airbus A350-900", "Boeing 777-300ER"][randInt(0, 2, seed)];
  if (km > 2500) return ["Airbus A321neo", "Boeing 787-8", "Airbus A330-300"][randInt(0, 2, seed)];
  if (al.type === "lcc") return ["Airbus A320neo", "Boeing 737 MAX 8", "Airbus A321neo"][randInt(0, 2, seed)];
  return ["Airbus A320neo", "Airbus A321neo", "Boeing 737-800"][randInt(0, 2, seed)];
}

function operatingDays(seed: string, smallRoute: boolean): number {
  if (!smallRoute || rand01("daily", seed) < 0.6) return ALL_DAYS;
  // drop two weekdays (never Friday/Sunday - the busiest days)
  const candidates = [0, 1, 2, 3, 5];
  const a = candidates[randInt(0, candidates.length - 1, seed, "a")];
  let b = candidates[randInt(0, candidates.length - 1, seed, "b")];
  if (b === a) b = (a + 1) % 4;
  return ALL_DAYS & ~(1 << a) & ~(1 << b);
}

function buildService(
  al: Airline,
  path: Airport[],
  seed: string,
  usedNumbers: Set<string>,
  smallRoute: boolean,
): Service {
  const depMin = pickDepMin(seed);
  const legs: Leg[] = [];
  let t = 0;
  const intl = !path.every((p) => p.region === "IN");
  for (let i = 0; i < path.length - 1; i++) {
    const dur = legDuration(path[i], path[i + 1]);
    legs.push({ from: path[i].code, to: path[i + 1].code, offsetMin: t, durationMin: dur });
    t += dur;
    if (i < path.length - 2) {
      t += intl ? round5(85 + rand01("lay", seed, i) * 200) : round5(55 + rand01("lay", seed, i) * 140);
    }
  }
  let num = 100 + (hashString(seed) % 880);
  while (usedNumbers.has(`${al.code}${num}`)) num = num + 7 > 999 ? 101 : num + 7;
  usedNumbers.add(`${al.code}${num}`);
  const km = distanceKm(path[0], path[path.length - 1]);
  return {
    airline: al.code,
    flightNo: `${al.code} ${num}`,
    from: path[0].code,
    to: path[path.length - 1].code,
    depMin,
    durationMin: t,
    stops: path.length - 2,
    via: path.slice(1, -1).map((p) => p.code),
    legs,
    days: operatingDays(seed, smallRoute),
    aircraft: aircraftFor(al, km, seed),
  };
}

const serviceCache = new Map<string, Service[]>();

/** Stable list of services between two airports (cached). */
export function servicesFor(fromCode: string, toCode: string): Service[] {
  const key = `${fromCode}-${toCode}`;
  const cached = serviceCache.get(key);
  if (cached) return cached;
  const A = getAirport(fromCode);
  const B = getAirport(toCode);
  if (!A || !B || A.code === B.code) return [];

  const dom = isDomestic(A, B);
  const km = distanceKm(A, B);
  const long = isLongHaul(A, B);
  const pk = pairKey(A.code, B.code);
  const used = new Set<string>();
  const out: Service[] = [];

  for (const al of AIRLINES) {
    if (dom && al.home !== "IN") continue; // no foreign carriers within India
    if (!dom && (!covers(al, A.region) || !covers(al, B.region))) continue;
    if (!dom && A.region === B.region && al.home !== A.region) continue;

    const isHub = al.hubs.includes(A.code) || al.hubs.includes(B.code);
    const homeEnd = al.home === A.region ? A : al.home === B.region ? B : null;
    const presence = rand01("presence", pk, al.code);
    const smallRoute = A.popularity * B.popularity < 0.3;

    // --- direct services ---
    let direct = false;
    let freq = 0;
    if (dom) {
      const score = A.popularity * B.popularity + (isHub ? 0.3 : 0);
      direct = score > 0.24 && presence < 0.55 + score * 0.5;
      freq = Math.max(1, Math.min(4, Math.round(score * 3.2 * (0.7 + 0.6 * rand01("freq", pk, al.code)))));
    } else if (homeEnd) {
      const other = homeEnd === A ? B : A;
      const need = long ? 0.75 : 0.42;
      direct = (al.hubs.includes(homeEnd.code) || homeEnd.popularity >= need) && other.popularity >= 0.45 && presence < 0.92;
      if (long && al.home === "IN" && !al.hubs.includes(homeEnd.code) && homeEnd.popularity < 0.8) direct = false;
      freq = long ? 1 : 1 + (A.popularity * B.popularity > 0.6 ? 1 : 0);
    }
    if (direct) {
      for (let i = 0; i < freq; i++) {
        out.push(buildService(al, [A, B], `${key}|${al.code}|d${i}`, used, smallRoute));
      }
    }

    // --- one-stop via an airline hub ---
    const hubs = al.hubs
      .map((h) => getAirport(h)!)
      .filter((H) => H.code !== A.code && H.code !== B.code)
      .filter((H) => (dom ? H.region === "IN" : covers(al, H.region)))
      .map((H) => ({ H, detour: distanceKm(A, H) + distanceKm(H, B) - km }))
      .filter(({ detour }) => detour < Math.max(900, km * 0.75))
      .sort((x, y) => x.detour - y.detour);
    const wantConnection = !direct || rand01("conn", pk, al.code) < 0.45;
    if (hubs.length && wantConnection) {
      out.push(buildService(al, [A, hubs[0].H, B], `${key}|${al.code}|c0`, used, smallRoute));
      if (hubs.length > 1 && rand01("conn2", pk, al.code) < 0.5) {
        out.push(buildService(al, [A, hubs[1].H, B], `${key}|${al.code}|c1`, used, smallRoute));
      }
    }

    // --- occasional two-stop routing through both hubs (cheapest, slowest) ---
    if (al.hubs.length === 2 && !isHub && km > 1200 && rand01("two", pk, al.code) < 0.3) {
      const [h1, h2] = al.hubs.map((h) => getAirport(h)!);
      const order = distanceKm(A, h1) + distanceKm(h2, B) <= distanceKm(A, h2) + distanceKm(h1, B) ? [h1, h2] : [h2, h1];
      if ((dom || order.every((H) => covers(al, H.region))) && order.every((H) => H.code !== A.code && H.code !== B.code)) {
        out.push(buildService(al, [A, order[0], order[1], B], `${key}|${al.code}|t0`, used, smallRoute));
      }
    }
  }

  // Guarantee choice on every pair: add frequencies to an existing non-stop
  // operator first, and only fall back to a hub connection when none exists.
  const directOp = out.find((s) => s.stops === 0);
  if (out.length < 3 && directOp) {
    const al = getAirline(directOp.airline)!;
    for (let i = 1; out.length < 3 && i < 4; i++) {
      out.push(buildService(al, [A, B], `${key}|${al.code}|x${i}`, used, false));
    }
  }
  if (out.length < 3) {
    const fallbackAl = dom ? getAirline("SF")! : getAirline("DF")!;
    const hubCode = dom ? (A.code === "DEL" || B.code === "DEL" ? "BOM" : "DEL") : A.code === "DXB" || B.code === "DXB" ? "DOH" : "DXB";
    const H = getAirport(hubCode)!;
    for (let i = 0; out.length < 3 && i < 3; i++) {
      out.push(buildService(fallbackAl, [A, H, B], `${key}|fb${i}`, used, false));
    }
  }

  out.sort((x, y) => x.depMin - y.depMin);
  serviceCache.set(key, out);
  return out;
}

export function operatesOn(s: Service, date: string): boolean {
  return (s.days & (1 << dayOfWeek(date))) !== 0;
}

export function stopsFactor(stops: number): number {
  return stops === 0 ? 1 : stops === 1 ? 0.88 : 0.8;
}

export function fmtTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Fare (per passenger, INR) for a service on a travel date, quoted on bookingDate. */
export function serviceFare(s: Service, date: string, bookingDate: string, cabin: Cabin): number {
  const A = getAirport(s.from)!;
  const B = getAirport(s.to)!;
  const al = getAirline(s.airline)!;
  return priceFor({
    from: A,
    to: B,
    depDate: date,
    bookingDate,
    daysBefore: diffDays(date, bookingDate),
    depMin: s.depMin,
    airlineFactor: al.factor,
    stopsFactor: stopsFactor(s.stops),
    cabin,
    noiseKey: `${s.flightNo}|${cabin}`,
  });
}

export function seatsLeft(s: Service, date: string, bookingDate: string, cabin: Cabin): number {
  const d = Math.max(0, diffDays(date, bookingDate));
  const cap = cabin === "business" ? 9 : 38;
  const fill = Math.min(0.97, 0.35 + 0.6 * Math.exp(-d / 20) + 0.25 * rand01("fill", s.flightNo, date, cabin));
  return Math.max(1, Math.round(cap * (1 - fill)) + (d > 45 ? randInt(2, 8, "extra", s.flightNo, date) : 0));
}

export function makeFlightId(s: Service, date: string, cabin: Cabin): string {
  return `${s.from}-${s.to}-${date}-${s.flightNo.replace(" ", "")}-${cabin === "business" ? "J" : "Y"}`;
}

export function toFlight(s: Service, date: string, bookingDate: string, cabin: Cabin): Flight {
  const A = getAirport(s.from)!;
  const B = getAirport(s.to)!;
  const arrLocal = s.depMin + s.durationMin + (B.utcOffset - A.utcOffset);
  const layovers: number[] = [];
  for (let i = 1; i < s.legs.length; i++) {
    const prev = s.legs[i - 1];
    layovers.push(s.legs[i].offsetMin - (prev.offsetMin + prev.durationMin));
  }
  return {
    id: makeFlightId(s, date, cabin),
    airline: s.airline,
    airlineName: getAirline(s.airline)!.name,
    flightNo: s.flightNo,
    from: s.from,
    to: s.to,
    date,
    depTime: fmtTime(s.depMin),
    arrTime: fmtTime(arrLocal),
    arrDayOffset: Math.floor(arrLocal / 1440),
    depMin: s.depMin,
    durationMin: s.durationMin,
    stops: s.stops,
    via: s.via,
    layoverMin: layovers,
    cabin,
    price: serviceFare(s, date, bookingDate, cabin),
    seatsLeft: seatsLeft(s, date, bookingDate, cabin),
    aircraft: s.aircraft,
    timeBucket: timeBucket(s.depMin),
    daysBefore: diffDays(date, bookingDate),
  };
}

export function cabinAvailable(s: Service, cabin: Cabin): boolean {
  return cabin === "economy" || getAirline(s.airline)!.business;
}

/** Minutes past local midnight right now at an airport. */
export function nowMinutesAt(utcOffset: number, now = Date.now()): number {
  const d = new Date(now + utcOffset * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export interface SearchOptions {
  from: string;
  to: string;
  date: string;
  cabin: Cabin;
  pax: number;
  bookingDate: string;
  /** Hide flights departing within 2 hours when searching for today. */
  now?: number;
}

export function searchFlights(o: SearchOptions): Flight[] {
  const A = getAirport(o.from);
  if (!A) return [];
  const isToday = o.date === o.bookingDate;
  const nowMin = isToday ? nowMinutesAt(A.utcOffset, o.now) : -1;
  return servicesFor(o.from, o.to)
    .filter((s) => operatesOn(s, o.date) && cabinAvailable(s, o.cabin))
    .filter((s) => !isToday || s.depMin > nowMin + 120)
    .map((s) => toFlight(s, o.date, o.bookingDate, o.cabin))
    .filter((f) => f.seatsLeft >= o.pax);
}

/** Cheapest per-passenger fare for a travel date (no time-of-day filter). */
export function lowestFare(from: string, to: string, date: string, bookingDate: string, cabin: Cabin): number | null {
  let best: number | null = null;
  for (const s of servicesFor(from, to)) {
    if (!operatesOn(s, date) || !cabinAvailable(s, cabin)) continue;
    const p = serviceFare(s, date, bookingDate, cabin);
    if (best === null || p < best) best = p;
  }
  return best;
}

export function findService(from: string, to: string, flightNo: string): Service | undefined {
  const compact = flightNo.replace(/\s+/g, "");
  return servicesFor(from, to).find((s) => s.flightNo.replace(" ", "") === compact);
}

export function parseFlightId(id: string): { from: string; to: string; date: string; flightNo: string; cabin: Cabin } | null {
  const m = /^([A-Z]{3})-([A-Z]{3})-(\d{4}-\d{2}-\d{2})-([A-Z]{2}\d{3})-(Y|J)$/.exec(id);
  if (!m) return null;
  return { from: m[1], to: m[2], date: m[3], flightNo: m[4], cabin: m[5] === "J" ? "business" : "economy" };
}

export function datesAround(date: string, radius: number): string[] {
  const out: string[] = [];
  for (let i = -radius; i <= radius; i++) out.push(addDays(date, i));
  return out;
}

export { TIME_BUCKETS };
