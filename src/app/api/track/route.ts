// POST /api/track  { items: [{ id, from, to, date, cabin, target }] }
// Simulates the daily price check for every watched route: current lowest
// fare, 30-day history and whether it is below the user's target price.
import { handleError, json, readJson } from "@/lib/api";
import { InputError, type TrackRequest, trackStatus } from "@/lib/services";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ items?: TrackRequest[] }>(req);
    if (!Array.isArray(body.items)) throw new InputError("badItems");
    const items = body.items
      .filter((i) => i && typeof i.id === "string")
      .map((i) => ({
        id: String(i.id).slice(0, 64),
        from: String(i.from ?? "").toUpperCase(),
        to: String(i.to ?? "").toUpperCase(),
        date: String(i.date ?? ""),
        cabin: i.cabin === "business" ? ("business" as const) : ("economy" as const),
        target: Number(i.target) || 0,
      }));
    return json({ results: trackStatus(items) });
  } catch (e) {
    return handleError(e);
  }
}
