// 8 fictional airlines. Names, codes and logos are invented for the demo and
// are not affiliated with any real carrier.
import type { Region } from "./airports.ts";

export type AirlineType = "lcc" | "hybrid" | "full";
export type LogoGlyph = "sun" | "drop" | "lotus" | "wave" | "feather" | "falcon" | "orchid" | "star";

export interface Airline {
  code: string;
  name: string;
  type: AirlineType;
  /** Fare multiplier vs. the market base fare. */
  factor: number;
  home: Region;
  /** Regions the airline flies to (besides home). */
  serves: Region[];
  hubs: string[];
  business: boolean;
  color: string;
  color2: string;
  glyph: LogoGlyph;
  onTime: number;
}

export const AIRLINES: Airline[] = [
  { code: "SF", name: "Saffron Air", type: "full", factor: 1.12, home: "IN", serves: ["ME", "SEA", "SA", "EU", "NA"], hubs: ["DEL", "BOM"], business: true, color: "#F59E0B", color2: "#C2410C", glyph: "sun", onTime: 0.87 },
  { code: "MJ", name: "Monsoon Jet", type: "lcc", factor: 0.87, home: "IN", serves: ["ME", "SEA", "SA"], hubs: ["BLR", "HYD"], business: false, color: "#14B8A6", color2: "#0F766E", glyph: "drop", onTime: 0.9 },
  { code: "LW", name: "Lotus Wings", type: "full", factor: 1.07, home: "IN", serves: ["SEA", "SA", "ME"], hubs: ["MAA", "CCU"], business: true, color: "#EC4899", color2: "#9D174D", glyph: "lotus", onTime: 0.84 },
  { code: "CR", name: "Coral Air", type: "lcc", factor: 0.9, home: "IN", serves: ["ME", "SA"], hubs: ["COK", "BOM"], business: false, color: "#FB7185", color2: "#BE123C", glyph: "wave", onTime: 0.82 },
  { code: "PC", name: "Peacock Airways", type: "hybrid", factor: 1.0, home: "IN", serves: ["SEA", "ME"], hubs: ["DEL", "HYD"], business: true, color: "#3B82F6", color2: "#1E40AF", glyph: "feather", onTime: 0.86 },
  { code: "DF", name: "Desert Falcon", type: "full", factor: 1.1, home: "ME", serves: ["IN", "SA", "EU", "NA", "SEA"], hubs: ["DXB", "DOH"], business: true, color: "#D97706", color2: "#78350F", glyph: "falcon", onTime: 0.9 },
  { code: "OP", name: "Orchid Pacific", type: "full", factor: 1.05, home: "SEA", serves: ["IN", "SA"], hubs: ["SIN", "BKK"], business: true, color: "#8B5CF6", color2: "#5B21B6", glyph: "orchid", onTime: 0.89 },
  { code: "NS", name: "Northstar Atlantic", type: "full", factor: 1.14, home: "EU", serves: ["IN", "NA", "ME"], hubs: ["LHR", "JFK"], business: true, color: "#1D4ED8", color2: "#172554", glyph: "star", onTime: 0.85 },
];

export const AIRLINE_BY_CODE: Record<string, Airline> = Object.fromEntries(AIRLINES.map((a) => [a.code, a]));
export const AIRLINE_INDEX: Record<string, number> = Object.fromEntries(AIRLINES.map((a, i) => [a.code, i]));

export function getAirline(code: string): Airline | undefined {
  return AIRLINE_BY_CODE[code];
}
