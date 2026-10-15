// GET /api/budget?from=MAA&to=DEL&date=2026-11-20&pax=1&cabin=economy
// Cheaper nearby dates (+/-3 days) and nearby airports for Budget mode.
import { handleError, json } from "@/lib/api";
import { budgetSuggestions, parseSearch } from "@/lib/services";

export async function GET(req: Request) {
  try {
    const q = parseSearch(new URL(req.url).searchParams);
    return json(budgetSuggestions(q));
  } catch (e) {
    return handleError(e);
  }
}
