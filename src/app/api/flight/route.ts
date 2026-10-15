// GET /api/flight?id=MAA-DEL-2026-11-20-MJ511-Y&pax=2
// Re-prices one flight at today's fare and returns its seat map + add-on prices
// for the booking flow.
import { handleError, json } from "@/lib/api";
import { addonPrice, type AddonId, seatMap } from "@/lib/booking";
import { resolveFlight } from "@/lib/services";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const flight = resolveFlight(sp.get("id") ?? "");
    const ids: AddonId[] = ["meal", "bag5", "bag10", "priority", "insurance"];
    const addons = Object.fromEntries(ids.map((a) => [a, addonPrice(a, flight.from, flight.to)]));
    return json({ flight, seatMap: seatMap(flight.id, flight.cabin), addons });
  } catch (e) {
    return handleError(e);
  }
}
