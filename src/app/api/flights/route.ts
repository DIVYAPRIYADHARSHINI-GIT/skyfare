// GET /api/flights?from=MAA&to=DEL&date=2026-11-20&pax=1&cabin=economy
// Returns all simulated flights for the day (filtering + sorting happen in
// the browser so changes feel instant).
import { handleError, json } from "@/lib/api";
import { parseSearch, runSearch } from "@/lib/services";

export async function GET(req: Request) {
  try {
    const q = parseSearch(new URL(req.url).searchParams);
    return json(runSearch(q));
  } catch (e) {
    return handleError(e);
  }
}
