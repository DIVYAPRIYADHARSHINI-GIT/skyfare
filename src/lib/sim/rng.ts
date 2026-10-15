// Deterministic pseudo-random helpers.
// Every "random" value in SkyFare (schedules, fares, seat maps, price checks)
// is derived from a string seed, so the server, the data generator and the
// browser always agree on the same simulated world without a database.

export function hashString(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform [0, 1) value for a seed made of parts. */
export function rand01(...parts: Array<string | number>): number {
  return mulberry32(hashString(parts.join("|")))();
}

/** Standard normal value for a seed made of parts (Box-Muller). */
export function randNormal(...parts: Array<string | number>): number {
  const r = mulberry32(hashString(parts.join("|")));
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randInt(min: number, maxInclusive: number, ...parts: Array<string | number>): number {
  return min + Math.floor(rand01(...parts) * (maxInclusive - min + 1));
}
