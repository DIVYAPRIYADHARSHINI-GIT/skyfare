// GET /api/model - model accuracy (MAE, RMSE, MAPE, R^2), feature importance
// and dataset summary for the About / Insights page.
import dataset from "@/data/ml/dataset-summary.json";
import metrics from "@/data/ml/model-metrics.json";
import { json } from "@/lib/api";

export const dynamic = "force-static";

export async function GET() {
  return json({ metrics, dataset }, { cache: "public, s-maxage=86400" });
}
