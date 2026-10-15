// POST /api/book - mock booking. Validates passengers, seats, contact and the
// dummy payment, re-prices the flight server-side and returns a booking with a
// reference. Nothing is charged and nothing is stored on the server: the
// browser keeps the booking in localStorage. Only the card's last 4 digits are
// ever sent here.
import { handleError, json, readJson } from "@/lib/api";
import { type PassengerInput, priceSummary, seatMap, validateEmail, validatePassenger, validatePhone, validUpi } from "@/lib/booking";
import { bookingReference, InputError, resolveFlight } from "@/lib/services";
import { getAirline } from "@/lib/sim/airlines";

interface BookBody {
  flightId: string;
  passengers: PassengerInput[];
  contact: { email: string; phone: string };
  extras?: { priority?: boolean; insurance?: boolean };
  payment: { method: "card" | "upi"; last4?: string; upiId?: string; cardValid?: boolean };
}

export async function POST(req: Request) {
  try {
    const body = await readJson<BookBody>(req);
    const flight = resolveFlight(String(body.flightId ?? ""));
    const pax = Array.isArray(body.passengers) ? body.passengers.slice(0, 9) : [];
    if (!pax.length) throw new InputError("badPax");
    if (pax.length > flight.seatsLeft) throw new InputError("soldOut");

    const errors: Record<string, string[]> = {};
    pax.forEach((p, i) => {
      const e = validatePassenger({ ...p, age: Number(p.age) });
      if (e.length) errors[`p${i}`] = e;
    });
    if (!validateEmail(body.contact?.email ?? "")) errors.contact = [...(errors.contact ?? []), "email"];
    if (!validatePhone(body.contact?.phone ?? "")) errors.contact = [...(errors.contact ?? []), "phone"];

    const map = seatMap(flight.id, flight.cabin);
    const seatInfo = new Map(map.rows.flatMap((r) => r.seats).map((s) => [s.id, s]));
    const chosen = pax.map((p) => p.seat).filter(Boolean) as string[];
    if (new Set(chosen).size !== chosen.length) errors.seats = ["duplicate"];
    for (const s of chosen) {
      const info = seatInfo.get(s);
      if (!info || info.taken) errors.seats = ["unavailable"];
    }

    const pay = body.payment;
    if (pay?.method === "card") {
      if (!/^\d{4}$/.test(pay.last4 ?? "") || pay.cardValid !== true) errors.payment = ["card"];
    } else if (pay?.method === "upi") {
      if (!validUpi(pay.upiId ?? "")) errors.payment = ["upi"];
    } else {
      errors.payment = ["method"];
    }
    if (Object.keys(errors).length) return json({ error: "validation", fields: errors }, { status: 422 });

    const seatPrices = Object.fromEntries([...seatInfo.values()].map((s) => [s.id, s.price]));
    const passengers = pax.map((p) => ({
      title: String(p.title ?? "").slice(0, 8),
      firstName: p.firstName.trim(),
      lastName: p.lastName.trim(),
      age: Number(p.age),
      gender: p.gender,
      seat: p.seat ?? null,
      meal: flight.cabin === "business" ? true : Boolean(p.meal),
      bag: p.bag === "bag5" || p.bag === "bag10" ? p.bag : "none",
    }));
    const summary = priceSummary(flight.price, pax, flight.from, flight.to, flight.cabin, body.extras ?? {}, seatPrices);
    const createdAt = new Date().toISOString();
    const ref = bookingReference(`${flight.id}|${createdAt}|${passengers.map((p) => p.lastName).join(",")}|${Math.random()}`);
    const gate = `${String.fromCharCode(65 + (ref.charCodeAt(0) % 6))}${(ref.charCodeAt(1) % 24) + 1}`;
    return json({
      booking: {
        ref,
        status: "confirmed",
        createdAt,
        flight: { ...flight, airlineName: getAirline(flight.airline)?.name ?? flight.airlineName },
        passengers,
        contact: { email: body.contact.email.trim(), phone: body.contact.phone.trim() },
        extras: { priority: Boolean(body.extras?.priority), insurance: Boolean(body.extras?.insurance) },
        payment: pay.method === "card" ? { method: "card", last4: pay.last4 } : { method: "upi", upiId: pay.upiId },
        summary,
        gate,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
