// Price prediction + "Book now / Wait" recommendation.
//
// For a route and a travel date the model predicts the fare you would pay if
// you booked on each of the next 30 days (days_before shrinks as you wait).
// The recommendation compares today's predicted fare with the cheapest
// predicted fare before departure, and turns the expected saving vs. the
// model's error (residual std from the test set) into a confidence level.
import modelJson from "@/data/ml/fare-model.json";
import metricsJson from "@/data/ml/model-metrics.json";
import { getAirport } from "../sim/airports.ts";
import { addDays, diffDays } from "../sim/dates.ts";
import { type Cabin, cabinFactor, TIME_BUCKETS, type TimeBucket } from "../sim/fares.ts";
import { lowestFare } from "../sim/schedule.ts";
import { buildFeatures, toVector } from "./features.ts";
import { type ExportedModel, predictPrice } from "./model.ts";

const MODEL = modelJson as unknown as ExportedModel;
const SIGMA = (metricsJson as { logResidualStd: number }).logResidualStd;

export interface ForecastPoint {
  /** Day you would book on. */
  bookingDate: string;
  daysBefore: number;
  predicted: number;
  low: number;
  high: number;
}

export interface Prediction {
  from: string;
  to: string;
  date: string;
  cabin: Cabin;
  today: string;
  daysBefore: number;
  currentFare: number | null;
  predictedToday: number;
  forecast: ForecastPoint[];
  best: ForecastPoint;
  action: "book" | "wait";
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  expectedSaving: number;
  waitDays: number;
  /** Message keys + params for the UI (translated client-side). */
  reasons: Array<{ key: string; params?: Record<string, string | number> }>;
  /** Forecast of the cheapest fare for each of the next 30 travel dates (booked today). */
  travelDateCurve: Array<{ date: string; predicted: number }>;
}

/** Cheapest predicted fare across time-of-day buckets (what a shopper would pick). */
function modelFare(from: string, to: string, depDate: string, daysBefore: number, cabin: Cabin, bucket?: TimeBucket): number {
  const A = getAirport(from)!;
  const B = getAirport(to)!;
  const buckets = bucket ? [bucket] : TIME_BUCKETS;
  let best = Infinity;
  for (const b of buckets) {
    const p = predictPrice(MODEL, toVector(buildFeatures(A, B, depDate, daysBefore, b), MODEL.features));
    if (p < best) best = p;
  }
  // The model is trained on economy fares; scale for business cabin.
  return best * cabinFactor(cabin, A, B);
}

function normCdf(z: number): number {
  // Abramowitz-Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function predictRoute(from: string, to: string, date: string, cabin: Cabin, today: string): Prediction {
  const daysBefore = Math.max(0, diffDays(date, today));
  const horizon = Math.min(30, daysBefore);
  const currentFare = lowestFare(from, to, date, today, cabin);
  // Calibrate the model's curve to today's observed lowest fare: the model
  // supplies the *shape* (how fares move as departure approaches), the live
  // fare anchors the level. The anchor is damped so one outlier quote can't
  // dominate (only 60% of the gap is applied).
  const raw0 = modelFare(from, to, date, daysBefore, cabin);
  const calib = currentFare ? Math.exp(0.6 * Math.log(currentFare / raw0)) : 1;
  const forecast: ForecastPoint[] = [];
  for (let i = 0; i <= horizon; i++) {
    const db = daysBefore - i;
    const p = modelFare(from, to, date, db, cabin) * calib;
    forecast.push({
      bookingDate: addDays(today, i),
      daysBefore: db,
      predicted: Math.round(p),
      low: Math.round(p * Math.exp(-SIGMA)),
      high: Math.round(p * Math.exp(SIGMA)),
    });
  }
  const now = forecast[0];
  const best = forecast.reduce((m, p) => (p.predicted < m.predicted ? p : m), now);
  const saving = now.predicted - best.predicted;
  const savingRatio = saving / now.predicted;
  const waitDays = diffDays(best.bookingDate, today);
  // Price after waiting is typically higher if we miss the dip: check trend.
  const in7 = forecast[Math.min(7, forecast.length - 1)];
  const rising = in7.predicted > now.predicted * 1.02;

  const wait = savingRatio >= 0.03 && saving >= 150 && waitDays > 0;
  // Confidence: probability that the saving (or the rise) is real given the
  // model's typical log error on the held-out set. Daily errors are strongly
  // correlated for one route, so use sigma / sqrt(2) for the difference.
  const sigmaDiff = SIGMA / Math.SQRT2;
  const z = wait ? Math.log(now.predicted / best.predicted) / sigmaDiff : Math.log(Math.max(in7.predicted, now.predicted * 1.0001) / now.predicted) / sigmaDiff + 0.6;
  const confidence = Math.round(Math.min(0.95, Math.max(0.55, normCdf(z))) * 100);
  const confidenceLabel = confidence >= 80 ? "high" : confidence >= 65 ? "medium" : "low";

  const reasons: Prediction["reasons"] = [];
  if (wait) {
    reasons.push({ key: "predict.reason.dropExpected", params: { amount: saving, days: waitDays } });
  } else {
    if (daysBefore <= 14) reasons.push({ key: "predict.reason.closeToDeparture", params: { days: daysBefore } });
    if (rising) reasons.push({ key: "predict.reason.rising", params: { amount: in7.predicted - now.predicted } });
    if (!rising && daysBefore > 14) reasons.push({ key: "predict.reason.stable" });
  }
  const A = getAirport(from)!;
  const B = getAirport(to)!;
  const hol = buildFeatures(A, B, date, daysBefore, "morning");
  if (hol.is_holiday) reasons.push({ key: "predict.reason.holiday" });
  const dow = hol.day_of_week;
  if (dow === 4 || dow === 6) reasons.push({ key: "predict.reason.weekend" });

  const travelDateCurve: Prediction["travelDateCurve"] = [];
  for (let i = 0; i < 30; i++) {
    const d = addDays(date, i);
    travelDateCurve.push({ date: d, predicted: Math.round(modelFare(from, to, d, diffDays(d, today), cabin)) });
  }

  return {
    from,
    to,
    date,
    cabin,
    today,
    daysBefore,
    currentFare,
    predictedToday: now.predicted,
    forecast,
    best,
    action: wait ? "wait" : "book",
    confidence,
    confidenceLabel,
    expectedSaving: Math.max(0, saving),
    waitDays: wait ? waitDays : 0,
    reasons,
    travelDateCurve,
  };
}

export function modelInfo() {
  return { trees: MODEL.trees.length, features: MODEL.features, sigma: SIGMA };
}
