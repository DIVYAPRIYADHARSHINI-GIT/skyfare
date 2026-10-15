// GET /api/dashboard - cheapest routes this month, trending destinations and
// fare trends (from the training data summary in src/data/ml/insights.json).
import insights from "@/data/ml/insights.json";
import { handleError, json } from "@/lib/api";
import { dashboardData } from "@/lib/services";

export async function GET() {
  try {
    return json({ ...dashboardData(), insights }, { cache: "public, s-maxage=3600, stale-while-revalidate=86400" });
  } catch (e) {
    return handleError(e);
  }
}
