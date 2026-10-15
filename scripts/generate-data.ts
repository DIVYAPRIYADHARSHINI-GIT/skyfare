// Generates SkyFare's sample fare history for ML training.
//
//   node scripts/generate-data.ts            (Node 22.18+ runs TypeScript natively)
//
// For every ordered airport pair (28 airports -> 756 routes) and every
// departure day in the 12 months before HISTORY_END, it records one observed
// fare: the cheapest economy fare in a time-of-day bucket, quoted at a random
// booking lead time (0-120 days). The rows carry the model features
// (src/lib/ml/features.ts) plus the target price.
//
// Outputs:
//   ml/data/fare_history.csv         full dataset (~276k rows, git-ignored)
//   ml/data/fare_history_sample.csv  first 2,000 rows (committed for reference)
//   src/data/ml/dataset-summary.json row counts and date range for the About page
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AIRPORTS } from "../src/lib/sim/airports.ts";
import { AIRLINES } from "../src/lib/sim/airlines.ts";
import { addDays } from "../src/lib/sim/dates.ts";
import { TIME_BUCKETS, timeBucket } from "../src/lib/sim/fares.ts";
import { rand01 } from "../src/lib/sim/rng.ts";
import { operatesOn, serviceFare, servicesFor } from "../src/lib/sim/schedule.ts";
import { buildFeatures, FEATURE_NAMES, toVector } from "../src/lib/ml/features.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Fixed window so the dataset (and model) is reproducible.
const HISTORY_END = process.env.HISTORY_END ?? "2026-10-14";
const HISTORY_DAYS = 365;
const HISTORY_START = addDays(HISTORY_END, -(HISTORY_DAYS - 1));

function sampleLead(key: string): number {
  const r = rand01("lead-mix", key);
  const u = rand01("lead-u", key);
  if (r < 0.4) return Math.floor(u * 15); // last two weeks
  if (r < 0.75) return 15 + Math.floor(u * 46); // 15-60 days
  return 61 + Math.floor(u * 60); // 61-120 days
}

const dataDir = join(ROOT, "ml", "data");
mkdirSync(dataDir, { recursive: true });
const out = createWriteStream(join(dataDir, "fare_history.csv"));
const header = ["route", "departure_date", "booking_date", "time_bucket", "airline", "stops", ...FEATURE_NAMES, "price"];
out.write(header.join(",") + "\n");
const sample: string[] = [header.join(",")];

let rows = 0;
const t0 = Date.now();
const routes = new Set<string>();
for (const A of AIRPORTS) {
  for (const B of AIRPORTS) {
    if (A.code === B.code) continue;
    const services = servicesFor(A.code, B.code);
    routes.add(`${A.code}-${B.code}`);
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const dep = addDays(HISTORY_START, i);
      const key = `${A.code}${B.code}${dep}`;
      const lead = sampleLead(key);
      const booking = addDays(dep, -lead);
      const todays = services.filter((s) => operatesOn(s, dep));
      const buckets = TIME_BUCKETS.filter((b) => todays.some((s) => timeBucket(s.depMin) === b));
      if (!buckets.length) continue;
      const bucket = buckets[Math.floor(rand01("bucket-pick", key) * buckets.length)];
      let best = Infinity;
      let bestSvc = todays[0];
      for (const s of todays) {
        if (timeBucket(s.depMin) !== bucket) continue;
        const p = serviceFare(s, dep, booking, "economy");
        if (p < best) {
          best = p;
          bestSvc = s;
        }
      }
      const feats = toVector(buildFeatures(A, B, dep, lead, bucket));
      const line = [`${A.code}-${B.code}`, dep, booking, bucket, bestSvc.airline, bestSvc.stops, ...feats, best].join(",");
      out.write(line + "\n");
      if (sample.length <= 2000) sample.push(line);
      rows++;
    }
  }
}
out.end();
writeFileSync(join(dataDir, "fare_history_sample.csv"), sample.join("\n") + "\n");

const summaryDir = join(ROOT, "src", "data", "ml");
mkdirSync(summaryDir, { recursive: true });
writeFileSync(
  join(summaryDir, "dataset-summary.json"),
  JSON.stringify(
    {
      rows,
      routes: routes.size,
      airports: AIRPORTS.length,
      airlines: AIRLINES.length,
      historyStart: HISTORY_START,
      historyEnd: HISTORY_END,
      days: HISTORY_DAYS,
      features: FEATURE_NAMES,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Wrote ${rows.toLocaleString()} rows for ${routes.size} routes (${HISTORY_START} .. ${HISTORY_END}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
