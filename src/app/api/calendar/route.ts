// GET /api/calendar?from=MAA&to=DEL&month=2026-11&cabin=economy
// Lowest fare for every day of the month (Budget mode fare calendar).
import { handleError, json } from "@/lib/api";
import { fareCalendar, InputError } from "@/lib/services";
import { getAirport } from "@/lib/sim/airports";
import type { Cabin } from "@/lib/sim/fares";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const from = (sp.get("from") ?? "").toUpperCase();
    const to = (sp.get("to") ?? "").toUpperCase();
    if (!getAirport(from) || !getAirport(to) || from === to) throw new InputError("badRoute");
    const cabin = (sp.get("cabin") === "business" ? "business" : "economy") as Cabin;
    return json(fareCalendar(from, to, sp.get("month") ?? "", cabin));
  } catch (e) {
    return handleError(e);
  }
}
