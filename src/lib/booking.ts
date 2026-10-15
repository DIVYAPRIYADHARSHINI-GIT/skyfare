// Mock booking rules shared by the booking API and the booking UI:
// seat maps, add-on prices, fare totals and passenger validation.
// No real payment is ever taken - the payment step only validates the
// format of test card / UPI details.
import { getAirport, isDomestic } from "./sim/airports.ts";
import type { Cabin } from "./sim/fares.ts";
import { rand01 } from "./sim/rng.ts";

export const ADDONS = {
  meal: { id: "meal", priceDomestic: 350, priceIntl: 750 },
  bag5: { id: "bag5", priceDomestic: 1500, priceIntl: 2800 },
  bag10: { id: "bag10", priceDomestic: 2800, priceIntl: 5200 },
  priority: { id: "priority", priceDomestic: 399, priceIntl: 699 },
  insurance: { id: "insurance", priceDomestic: 249, priceIntl: 599 },
} as const;

export type AddonId = keyof typeof ADDONS;

export interface SeatMapRow {
  row: number;
  seats: Array<{ id: string; taken: boolean; kind: "window" | "middle" | "aisle"; extraLegroom: boolean; price: number }>;
}

export interface SeatMap {
  cabin: Cabin;
  letters: string[];
  /** Index after which an aisle is drawn. */
  aisleAfter: number[];
  rows: SeatMapRow[];
}

export function seatMap(flightId: string, cabin: Cabin): SeatMap {
  const business = cabin === "business";
  const letters = business ? ["A", "C", "D", "F"] : ["A", "B", "C", "D", "E", "F"];
  const aisleAfter = business ? [1] : [2];
  const firstRow = business ? 1 : 6;
  const nRows = business ? 5 : 24;
  const rows: SeatMapRow[] = [];
  for (let r = firstRow; r < firstRow + nRows; r++) {
    const extraLegroom = !business && (r === firstRow || r === 14 || r === 15);
    rows.push({
      row: r,
      seats: letters.map((l, i) => {
        const kind = i === 0 || i === letters.length - 1 ? "window" : aisleAfter.includes(i) || aisleAfter.includes(i - 1) ? "aisle" : "middle";
        const taken = rand01("seat", flightId, r, l) < (business ? 0.45 : 0.55);
        let price = 0;
        if (!business) {
          if (extraLegroom) price = 899;
          else if (r <= 10) price = kind === "middle" ? 199 : 349;
          else if (kind !== "middle") price = 249;
        }
        return { id: `${r}${l}`, taken, kind, extraLegroom, price };
      }),
    });
  }
  return { cabin, letters, aisleAfter, rows };
}

export function addonPrice(id: AddonId, from: string, to: string): number {
  const A = getAirport(from);
  const B = getAirport(to);
  const dom = A && B ? isDomestic(A, B) : true;
  return dom ? ADDONS[id].priceDomestic : ADDONS[id].priceIntl;
}

export interface PassengerInput {
  title: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  seat?: string;
  meal?: boolean;
  bag?: "none" | "bag5" | "bag10";
}

export interface PriceSummary {
  baseFare: number;
  taxes: number;
  convenienceFee: number;
  seats: number;
  meals: number;
  baggage: number;
  extras: number;
  total: number;
}

export function priceSummary(
  fare: number,
  pax: PassengerInput[],
  from: string,
  to: string,
  cabin: Cabin,
  extras: { priority?: boolean; insurance?: boolean },
  seatPrices: Record<string, number>,
): PriceSummary {
  const A = getAirport(from);
  const B = getAirport(to);
  const dom = A && B ? isDomestic(A, B) : true;
  const n = pax.length;
  const baseFare = fare * n;
  // Simplified taxes: GST on base fare + airport/user development fees.
  const taxRate = cabin === "business" ? 0.12 : 0.05;
  const taxes = Math.round(baseFare * taxRate + n * (dom ? 650 : 1650));
  const convenienceFee = 199 * n;
  const seats = pax.reduce((s, p) => s + (p.seat ? (seatPrices[p.seat] ?? 0) : 0), 0);
  const meals = cabin === "business" ? 0 : pax.filter((p) => p.meal).length * addonPrice("meal", from, to);
  const baggage = pax.reduce((s, p) => s + (p.bag && p.bag !== "none" ? addonPrice(p.bag, from, to) : 0), 0);
  const extrasTotal =
    (extras.priority ? addonPrice("priority", from, to) * n : 0) + (extras.insurance ? addonPrice("insurance", from, to) * n : 0);
  return {
    baseFare,
    taxes,
    convenienceFee,
    seats,
    meals,
    baggage,
    extras: extrasTotal,
    total: baseFare + taxes + convenienceFee + seats + meals + baggage + extrasTotal,
  };
}

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{0,39}$/u;

export function validatePassenger(p: PassengerInput): string[] {
  const errs: string[] = [];
  if (!NAME_RE.test((p.firstName ?? "").trim())) errs.push("firstName");
  if (!NAME_RE.test((p.lastName ?? "").trim())) errs.push("lastName");
  if (!Number.isInteger(p.age) || p.age < 0 || p.age > 110) errs.push("age");
  if (!["male", "female", "other"].includes(p.gender)) errs.push("gender");
  return errs;
}

export function validateEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
}

export function validatePhone(p: string): boolean {
  return /^\+?[0-9 ()-]{7,16}$/.test(p.trim()) && p.replace(/\D/g, "").length >= 7;
}

/** Luhn check so the dummy payment form behaves like a real one. */
export function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function validExpiry(mmYY: string, now = new Date()): boolean {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(mmYY.trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const end = Date.UTC(year, month, 1);
  return end > now.getTime();
}

export function validUpi(id: string): boolean {
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/.test(id.trim());
}
