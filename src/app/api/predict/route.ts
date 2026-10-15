// GET /api/predict?from=MAA&to=DEL&date=2026-11-20&cabin=economy
// Runs the exported gradient-boosting model (pure TypeScript) and returns the
// 30-day price forecast plus a Book now / Wait recommendation.
import { handleError, json } from "@/lib/api";
import { predictRoute } from "@/lib/ml/predict";
import { parseSearch } from "@/lib/services";
import { todayISO } from "@/lib/sim/dates";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    if (!sp.get("pax")) sp.set("pax", "1");
    const q = parseSearch(sp);
    return json(predictRoute(q.from, q.to, q.date, q.cabin, todayISO()));
  } catch (e) {
    return handleError(e);
  }
}
