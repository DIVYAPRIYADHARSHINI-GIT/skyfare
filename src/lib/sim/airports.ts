// 28 sample airports (17 Indian + 11 international). Coordinates are real so
// distances, durations and "nearby airport" suggestions are believable.
// popularity (0-1) drives schedule frequency and demand in the simulator.

export type Region = "IN" | "ME" | "SA" | "SEA" | "EU" | "NA";

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
  region: Region;
  lat: number;
  lon: number;
  /** Fixed UTC offset in minutes (DST ignored for the demo). */
  utcOffset: number;
  popularity: number;
  /** Destination flavour used by seasonality (beach peaks in winter, etc.). */
  kind?: "beach" | "heritage" | "metro" | "hill";
  /** Photo file in /public/images/destinations (without extension). */
  photo?: string;
}

export const AIRPORTS: Airport[] = [
  { code: "DEL", city: "Delhi", name: "Indira Gandhi International", country: "India", region: "IN", lat: 28.5562, lon: 77.1, utcOffset: 330, popularity: 1.0, kind: "heritage" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International", country: "India", region: "IN", lat: 19.0896, lon: 72.8656, utcOffset: 330, popularity: 0.98, kind: "metro" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda International", country: "India", region: "IN", lat: 13.1986, lon: 77.7066, utcOffset: 330, popularity: 0.9, kind: "metro" },
  { code: "MAA", city: "Chennai", name: "Chennai International", country: "India", region: "IN", lat: 12.9941, lon: 80.1709, utcOffset: 330, popularity: 0.86, kind: "metro" },
  { code: "HYD", city: "Hyderabad", name: "Rajiv Gandhi International", country: "India", region: "IN", lat: 17.2403, lon: 78.4294, utcOffset: 330, popularity: 0.84, kind: "heritage" },
  { code: "CCU", city: "Kolkata", name: "Netaji Subhas Chandra Bose International", country: "India", region: "IN", lat: 22.6547, lon: 88.4467, utcOffset: 330, popularity: 0.78, kind: "heritage" },
  { code: "COK", city: "Kochi", name: "Cochin International", country: "India", region: "IN", lat: 10.152, lon: 76.4019, utcOffset: 330, popularity: 0.66, kind: "beach" },
  { code: "GOI", city: "Goa", name: "Goa International (Dabolim)", country: "India", region: "IN", lat: 15.3808, lon: 73.8314, utcOffset: 330, popularity: 0.72, kind: "beach" },
  { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International", country: "India", region: "IN", lat: 23.0772, lon: 72.6347, utcOffset: 330, popularity: 0.6, kind: "heritage" },
  { code: "PNQ", city: "Pune", name: "Pune International", country: "India", region: "IN", lat: 18.5822, lon: 73.9197, utcOffset: 330, popularity: 0.6, kind: "metro" },
  { code: "JAI", city: "Jaipur", name: "Jaipur International", country: "India", region: "IN", lat: 26.8242, lon: 75.8122, utcOffset: 330, popularity: 0.56, kind: "heritage" },
  { code: "LKO", city: "Lucknow", name: "Chaudhary Charan Singh International", country: "India", region: "IN", lat: 26.7606, lon: 80.8893, utcOffset: 330, popularity: 0.5, kind: "heritage" },
  { code: "TRV", city: "Thiruvananthapuram", name: "Trivandrum International", country: "India", region: "IN", lat: 8.4821, lon: 76.9201, utcOffset: 330, popularity: 0.46, kind: "beach" },
  { code: "CJB", city: "Coimbatore", name: "Coimbatore International", country: "India", region: "IN", lat: 11.03, lon: 77.0434, utcOffset: 330, popularity: 0.42, kind: "hill" },
  { code: "IXM", city: "Madurai", name: "Madurai Airport", country: "India", region: "IN", lat: 9.8345, lon: 78.0934, utcOffset: 330, popularity: 0.36, kind: "heritage" },
  { code: "GAU", city: "Guwahati", name: "Lokpriya Gopinath Bordoloi International", country: "India", region: "IN", lat: 26.1061, lon: 91.5859, utcOffset: 330, popularity: 0.4, kind: "hill" },
  { code: "VTZ", city: "Visakhapatnam", name: "Visakhapatnam International", country: "India", region: "IN", lat: 17.7212, lon: 83.2245, utcOffset: 330, popularity: 0.38, kind: "beach" },
  { code: "DXB", city: "Dubai", name: "Dubai International", country: "United Arab Emirates", region: "ME", lat: 25.2532, lon: 55.3657, utcOffset: 240, popularity: 0.95, kind: "metro" },
  { code: "AUH", city: "Abu Dhabi", name: "Zayed International", country: "United Arab Emirates", region: "ME", lat: 24.433, lon: 54.6511, utcOffset: 240, popularity: 0.6, kind: "metro" },
  { code: "SHJ", city: "Sharjah", name: "Sharjah International", country: "United Arab Emirates", region: "ME", lat: 25.3286, lon: 55.5172, utcOffset: 240, popularity: 0.5, kind: "metro" },
  { code: "DOH", city: "Doha", name: "Hamad International", country: "Qatar", region: "ME", lat: 25.2731, lon: 51.6081, utcOffset: 180, popularity: 0.7, kind: "metro" },
  { code: "SIN", city: "Singapore", name: "Singapore Changi", country: "Singapore", region: "SEA", lat: 1.3644, lon: 103.9915, utcOffset: 480, popularity: 0.86, kind: "metro" },
  { code: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International", country: "Malaysia", region: "SEA", lat: 2.7456, lon: 101.7099, utcOffset: 480, popularity: 0.6, kind: "metro" },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi", country: "Thailand", region: "SEA", lat: 13.69, lon: 100.7501, utcOffset: 420, popularity: 0.78, kind: "beach" },
  { code: "CMB", city: "Colombo", name: "Bandaranaike International", country: "Sri Lanka", region: "SA", lat: 7.1808, lon: 79.8841, utcOffset: 330, popularity: 0.5, kind: "beach" },
  { code: "LHR", city: "London", name: "Heathrow", country: "United Kingdom", region: "EU", lat: 51.47, lon: -0.4543, utcOffset: 0, popularity: 0.85, kind: "heritage" },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", country: "France", region: "EU", lat: 49.0097, lon: 2.5479, utcOffset: 60, popularity: 0.72, kind: "heritage" },
  { code: "JFK", city: "New York", name: "John F. Kennedy International", country: "United States", region: "NA", lat: 40.6413, lon: -73.7781, utcOffset: -300, popularity: 0.82, kind: "metro" },
];

export const AIRPORT_BY_CODE: Record<string, Airport> = Object.fromEntries(
  AIRPORTS.map((a) => [a.code, a]),
);

/** Stable integer id used as a model feature (index in AIRPORTS). */
export const AIRPORT_INDEX: Record<string, number> = Object.fromEntries(
  AIRPORTS.map((a, i) => [a.code, i]),
);

export function getAirport(code: string | null | undefined): Airport | undefined {
  if (!code) return undefined;
  return AIRPORT_BY_CODE[code.toUpperCase()];
}

export function distanceKm(a: Airport, b: Airport): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function isDomestic(a: Airport, b: Airport): boolean {
  return a.region === "IN" && b.region === "IN";
}

/** Airports within `maxKm` of the given airport (used for budget suggestions). */
export function nearbyAirports(code: string, maxKm = 320): Array<{ airport: Airport; km: number }> {
  const a = getAirport(code);
  if (!a) return [];
  return AIRPORTS.filter((b) => b.code !== a.code)
    .map((b) => ({ airport: b, km: distanceKm(a, b) }))
    .filter((x) => x.km <= maxKm)
    .sort((x, y) => x.km - y.km);
}
