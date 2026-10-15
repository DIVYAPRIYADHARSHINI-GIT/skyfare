// Festival and holiday dates that drive demand spikes (2025-2027).
// Dates follow timeanddate.com / Government of India holiday lists.
// `weight` is the peak fare uplift; `airports` limits a regional festival
// (Onam for Kerala, Durga Puja for Kolkata, ...) to the cities where it matters.

export interface Holiday {
  date: string;
  name: string;
  weight: number;
  airports?: string[];
}

const SOUTH = ["MAA", "CJB", "IXM", "TRV", "BLR", "HYD", "VTZ"];
const KERALA = ["COK", "TRV"];
const GULF = ["DXB", "AUH", "SHJ", "DOH"];

function yearly(year: number): Holiday[] {
  const d: Record<number, Record<string, string>> = {
    2025: { diwali: "2025-10-20", dussehra: "2025-10-02", holi: "2025-03-14", eidFitr: "2025-03-31", eidAdha: "2025-06-07", onam: "2025-09-05", ganesh: "2025-08-27", durga: "2025-09-30", goodFriday: "2025-04-18" },
    2026: { diwali: "2026-11-08", dussehra: "2026-10-20", holi: "2026-03-04", eidFitr: "2026-03-21", eidAdha: "2026-05-27", onam: "2026-08-26", ganesh: "2026-09-14", durga: "2026-10-19", goodFriday: "2026-04-03" },
    2027: { diwali: "2027-10-29", dussehra: "2027-10-09", holi: "2027-03-22", eidFitr: "2027-03-10", eidAdha: "2027-05-17", onam: "2027-09-12", ganesh: "2027-09-04", durga: "2027-10-07", goodFriday: "2027-03-26" },
  };
  const y = d[year];
  return [
    { date: `${year}-01-01`, name: "New Year", weight: 0.22 },
    { date: `${year}-01-14`, name: "Pongal / Makar Sankranti", weight: 0.32, airports: SOUTH },
    { date: `${year}-01-26`, name: "Republic Day", weight: 0.12 },
    { date: y.holi, name: "Holi", weight: 0.26 },
    { date: y.eidFitr, name: "Eid al-Fitr", weight: 0.3, airports: [...GULF, "COK", "HYD", "LKO", "BOM"] },
    { date: y.goodFriday, name: "Good Friday", weight: 0.12 },
    { date: y.eidAdha, name: "Eid al-Adha", weight: 0.26, airports: [...GULF, "COK", "HYD", "LKO"] },
    { date: `${year}-08-15`, name: "Independence Day", weight: 0.14 },
    { date: y.onam, name: "Onam", weight: 0.34, airports: KERALA },
    { date: y.ganesh, name: "Ganesh Chaturthi", weight: 0.24, airports: ["BOM", "PNQ", "GOI", "HYD"] },
    { date: y.durga, name: "Durga Puja", weight: 0.34, airports: ["CCU", "GAU"] },
    { date: y.dussehra, name: "Dussehra", weight: 0.24 },
    { date: y.diwali, name: "Diwali", weight: 0.45 },
    { date: `${year}-12-25`, name: "Christmas", weight: 0.3 },
    { date: `${year}-12-31`, name: "New Year's Eve", weight: 0.28 },
  ];
}

export const HOLIDAYS: Holiday[] = [2025, 2026, 2027].flatMap(yearly).sort((a, b) => a.date.localeCompare(b.date));
