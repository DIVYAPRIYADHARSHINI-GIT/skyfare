// API response shapes shared by pages (inferred from the server functions).
import type { budgetSuggestions, dashboardData, fareCalendar, runSearch, trackStatus } from "./services";
import type { Prediction } from "./ml/predict";
import type { SeatMap } from "./booking";
import type { Flight } from "./sim/schedule";
import type insights from "@/data/ml/insights.json";
import type metrics from "@/data/ml/model-metrics.json";
import type dataset from "@/data/ml/dataset-summary.json";

export type SearchResponse = ReturnType<typeof runSearch>;
export type ScoredFlight = SearchResponse["flights"][number];
export type CalendarResponse = ReturnType<typeof fareCalendar>;
export type BudgetResponse = ReturnType<typeof budgetSuggestions>;
export type DashboardResponse = ReturnType<typeof dashboardData> & { insights: typeof insights };
export type TrackResponse = { results: ReturnType<typeof trackStatus> };
export type ModelResponse = { metrics: typeof metrics; dataset: typeof dataset };
export type PredictResponse = Prediction;
export type FlightDetailResponse = { flight: Flight; seatMap: SeatMap; addons: Record<string, number> };
