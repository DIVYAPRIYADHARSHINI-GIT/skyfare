// Model features - the single source of truth shared by the dataset
// generator (scripts/generate-data.ts) and the prediction API, so training
// and serving can never drift apart. The Python trainer reads these columns
// from the CSV and stores their order in fare-model.json.
import { type Airport, AIRPORT_INDEX, distanceKm, isDomestic } from "../sim/airports.ts";
import { dayOfWeek, monthOf } from "../sim/dates.ts";
import { holidayEffect, isLongHaul, TIME_BUCKETS, type TimeBucket } from "../sim/fares.ts";

export const FEATURE_NAMES = [
  "origin_idx",
  "dest_idx",
  "distance_km",
  "is_domestic",
  "is_long_haul",
  "origin_region",
  "dest_region",
  "dest_kind",
  "origin_pop",
  "dest_pop",
  "days_before",
  "day_of_week",
  "month",
  "is_holiday",
  "holiday_importance",
  "days_to_holiday",
  "time_of_day",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export type FeatureRow = Record<FeatureName, number>;

const REGIONS = ["IN", "ME", "SA", "SEA", "EU", "NA"];
const KINDS = ["metro", "heritage", "beach", "hill"];

export function buildFeatures(
  from: Airport,
  to: Airport,
  depDate: string,
  daysBefore: number,
  bucket: TimeBucket,
): FeatureRow {
  const h = holidayEffect(depDate, from.code, to.code);
  return {
    origin_idx: AIRPORT_INDEX[from.code],
    dest_idx: AIRPORT_INDEX[to.code],
    distance_km: distanceKm(from, to),
    is_domestic: isDomestic(from, to) ? 1 : 0,
    is_long_haul: isLongHaul(from, to) ? 1 : 0,
    origin_region: REGIONS.indexOf(from.region),
    dest_region: REGIONS.indexOf(to.region),
    dest_kind: Math.max(0, KINDS.indexOf(to.kind ?? "metro")),
    origin_pop: from.popularity,
    dest_pop: to.popularity,
    days_before: Math.max(0, Math.min(180, daysBefore)),
    day_of_week: dayOfWeek(depDate),
    month: monthOf(depDate),
    is_holiday: h.name ? 1 : 0,
    holiday_importance: h.importance,
    days_to_holiday: h.daysToHoliday ?? 9,
    time_of_day: TIME_BUCKETS.indexOf(bucket),
  };
}

export function toVector(row: FeatureRow, order: readonly string[] = FEATURE_NAMES): number[] {
  return order.map((n) => row[n as FeatureName]);
}
