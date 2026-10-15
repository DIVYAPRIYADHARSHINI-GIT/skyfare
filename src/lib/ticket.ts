"use client";
// E-ticket PDF generated in the browser with jsPDF (loaded on demand).
// The ticket is always in English with Latin fonts - like real airline
// tickets - because jsPDF's built-in fonts cannot render Indic/Arabic scripts.
import type { Booking } from "./storage";
import { AIRLINE_BY_CODE } from "./sim/airlines";
import { getAirport } from "./sim/airports";
import en from "@/i18n/messages/en";

const inr = (n: number) => `INR ${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function minutesToHm(min: number) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

/** Strip characters the core PDF fonts can't encode (names may be typed in any script). */
function latin(s: string) {
  const out = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
  return out.trim() || "-";
}

export async function buildTicketPdf(b: Booking) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const f = b.flight;
  const al = AIRLINE_BY_CODE[f.airline];
  const from = getAirport(f.from)!;
  const to = getAirport(f.to)!;
  const brand: [number, number, number] = [20, 121, 237];
  const W = 210;

  // Header band
  doc.setFillColor(...brand);
  doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("SkyFare", 16, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(en["app.tagline"], 16, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(en["ticket.title"], W - 16, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${en["ticket.ref"]}: ${b.ref}`, W - 16, 22, { align: "right" });
  doc.text(`${en["ticket.issued"]}: ${new Date(b.createdAt).toUTCString().slice(5, 22)} UTC`, W - 16, 28, { align: "right" });

  // Airline block
  const [r, g, bl] = hexToRgb(al?.color ?? "#1479ed");
  doc.setFillColor(r, g, bl);
  doc.roundedRect(16, 42, 14, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(f.airline, 23, 50.5, { align: "center" });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.text(al?.name ?? f.airlineName, 34, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${en["ticket.flight"]} ${f.flightNo}  ·  ${f.aircraft}  ·  ${f.cabin === "business" ? "Business" : "Economy"}`, 34, 54);

  // Status pill
  const cancelled = b.status === "cancelled";
  doc.setFillColor(...(cancelled ? ([244, 63, 94] as [number, number, number]) : ([16, 185, 129] as [number, number, number])));
  doc.roundedRect(W - 50, 44, 34, 9, 4.5, 4.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(cancelled ? "CANCELLED" : "CONFIRMED", W - 33, 49.8, { align: "center" });

  // Route
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, 62, W - 32, 44, 4, 4, "S");
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(f.from, 26, 80);
  doc.text(f.to, W - 26, 80, { align: "right" });
  doc.setFontSize(13);
  doc.text(f.depTime, 26, 89);
  doc.text(`${f.arrTime}${f.arrDayOffset ? ` (+${f.arrDayOffset})` : ""}`, W - 26, 89, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(latin(`${from.city} - ${from.name}`), 26, 96);
  doc.text(latin(`${to.city} - ${to.name}`), W - 26, 96, { align: "right" });
  doc.text(new Date(`${f.date}T00:00:00Z`).toUTCString().slice(0, 16), 26, 101);
  // dashed line with plane
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(62, 77, W - 62, 77);
  doc.setLineDashPattern([], 0);
  doc.setFillColor(...brand);
  doc.triangle(W / 2 - 3, 74.5, W / 2 - 3, 79.5, W / 2 + 4, 77, "F");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text(`${minutesToHm(f.durationMin)}  ·  ${f.stops === 0 ? "Non-stop" : `${f.stops} stop${f.stops > 1 ? "s" : ""} via ${f.via.join(", ")}`}`, W / 2, 85, { align: "center" });

  // Info row
  const info: Array<[string, string]> = [
    [en["ticket.gate"], b.gate],
    [en["ticket.boarding"], (() => {
      const [h, m] = f.depTime.split(":").map(Number);
      const t = (h * 60 + m - 45 + 1440) % 1440;
      return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    })()],
    [en["ticket.class"], f.cabin === "business" ? "Business" : "Economy"],
    [en["ticket.payment"], b.payment.method === "card" ? `Card **** ${b.payment.last4}` : `UPI ${latin(b.payment.upiId ?? "")}`],
  ];
  info.forEach(([k, v], i) => {
    const x = 16 + i * ((W - 32) / 4);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(k.toUpperCase(), x, 116);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(v, x, 122);
    doc.setFont("helvetica", "normal");
  });

  // Passengers table
  let y = 134;
  doc.setFillColor(241, 245, 249);
  doc.rect(16, y - 5, W - 32, 8, "F");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  const cols = [18, 100, 130, 165];
  [en["ticket.passenger"], en["ticket.seat"], en["ticket.baggage"], en["ticket.meal"]].forEach((h, i) => doc.text(h.toUpperCase(), cols[i], y));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  for (const p of b.passengers) {
    y += 9;
    doc.text(latin(`${p.title} ${p.firstName} ${p.lastName}`).slice(0, 40), cols[0], y);
    doc.text(p.seat ?? "-", cols[1], y);
    doc.text(`${f.cabin === "business" ? "2x32 kg" : "15 kg"}${p.bag === "bag5" ? " +5 kg" : p.bag === "bag10" ? " +10 kg" : ""}`, cols[2], y);
    doc.text(p.meal ? "Yes" : "-", cols[3], y);
    doc.setDrawColor(226, 232, 240);
    doc.line(16, y + 3, W - 16, y + 3);
  }

  // Fare summary
  y += 14;
  const s = b.summary;
  const lines: Array<[string, number]> = [
    [`Base fare (${b.passengers.length} x ${inr(f.price)})`, s.baseFare],
    ["Taxes & airport fees", s.taxes],
    ["Convenience fee", s.convenienceFee],
    ...(s.seats ? ([["Seat selection", s.seats]] as Array<[string, number]>) : []),
    ...(s.meals ? ([["Meals", s.meals]] as Array<[string, number]>) : []),
    ...(s.baggage ? ([["Extra baggage", s.baggage]] as Array<[string, number]>) : []),
    ...(s.extras ? ([["Priority & insurance", s.extras]] as Array<[string, number]>) : []),
  ];
  doc.setFontSize(10);
  for (const [k, v] of lines) {
    doc.setTextColor(71, 85, 105);
    doc.text(k, 110, y);
    doc.setTextColor(15, 23, 42);
    doc.text(inr(v), W - 16, y, { align: "right" });
    y += 6;
  }
  doc.setDrawColor(...brand);
  doc.line(110, y - 2, W - 16, y - 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(en["ticket.total"], 110, y + 4);
  doc.text(inr(s.total), W - 16, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");

  // Simple barcode-like strip from the booking reference
  const bx = 16;
  const by = y - 30;
  let x = bx;
  const code = `${b.ref}${f.flightNo.replace(" ", "")}${f.date.replace(/-/g, "")}`;
  doc.setFillColor(15, 23, 42);
  for (const ch of code) {
    const c = ch.charCodeAt(0);
    for (let k = 0; k < 4; k++) {
      const w = ((c >> k) & 1) + 0.4;
      if ((c + k) % 2 === 0) doc.rect(x, by, w, 18, "F");
      x += w + 0.5;
    }
    if (x > 95) break;
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(b.ref, bx, by + 23);

  // Contact + notice
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Contact: ${latin(b.contact.email)}  ·  ${latin(b.contact.phone)}`, 16, 270);
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(16, 276, W - 32, 10, 2, 2, "F");
  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.text(en["ticket.notice"], W / 2, 282.5, { align: "center" });
  return doc;
}

export async function downloadTicket(b: Booking) {
  const doc = await buildTicketPdf(b);
  doc.save(`SkyFare-eticket-${b.ref}.pdf`);
}
