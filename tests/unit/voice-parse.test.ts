import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVoiceQuery } from "../../src/lib/voice/parse.ts";

// 2026-10-15 is a Thursday.
const TODAY = "2026-10-15";

test("English: flights from Chennai to Delhi next Friday", () => {
  const q = parseVoiceQuery("flights from Chennai to Delhi next Friday", TODAY);
  assert.equal(q.from, "MAA");
  assert.equal(q.to, "DEL");
  // coming Friday is 2026-10-16 (1 day away), "next Friday" -> 2026-10-23
  assert.equal(q.date, "2026-10-23");
});

test("English: to-first ordering and passengers", () => {
  const q = parseVoiceQuery("I want to go to Goa from Bangalore tomorrow for 2 people", TODAY);
  assert.deepEqual([q.from, q.to, q.date, q.pax], ["BLR", "GOI", "2026-10-16", 2]);
});

test("English: explicit date and business", () => {
  const q = parseVoiceQuery("business class Mumbai to Dubai on 12 December", TODAY);
  assert.deepEqual([q.from, q.to, q.date, q.cabin], ["BOM", "DXB", "2026-12-12", "business"]);
});

test("Hindi postpositions", () => {
  const q = parseVoiceQuery("दिल्ली से मुंबई कल की फ्लाइट 3 यात्री", TODAY);
  assert.deepEqual([q.from, q.to, q.date, q.pax], ["DEL", "BOM", "2026-10-16", 3]);
});

test("Tamil case endings", () => {
  const q = parseVoiceQuery("சென்னையிலிருந்து டெல்லிக்கு நாளை விமானம்", TODAY);
  assert.deepEqual([q.from, q.to, q.date], ["MAA", "DEL", "2026-10-16"]);
});

test("Tamil: destination mentioned first", () => {
  const q = parseVoiceQuery("டெல்லிக்கு சென்னையிலிருந்து", TODAY);
  assert.deepEqual([q.from, q.to], ["MAA", "DEL"]);
});

test("Telugu", () => {
  const q = parseVoiceQuery("హైదరాబాద్ నుండి బెంగళూరు కి రేపు", TODAY);
  assert.deepEqual([q.from, q.to, q.date], ["HYD", "BLR", "2026-10-16"]);
});

test("Spanish and French", () => {
  const es = parseVoiceQuery("vuelos de Bombay a Goa el viernes", TODAY);
  assert.deepEqual([es.from, es.to, es.date], ["BOM", "GOI", "2026-10-16"]);
  const fr = parseVoiceQuery("vols de Paris à Dubaï demain", TODAY);
  assert.deepEqual([fr.from, fr.to, fr.date], ["CDG", "DXB", "2026-10-16"]);
});

test("Arabic", () => {
  const q = parseVoiceQuery("رحلات من دبي إلى مومباي غدا", TODAY);
  assert.deepEqual([q.from, q.to, q.date], ["DXB", "BOM", "2026-10-16"]);
});

test("Bengali, Kannada, Malayalam, Marathi", () => {
  assert.deepEqual(Object.values(parseVoiceQuery("কলকাতা থেকে দিল্লি", TODAY)).slice(0, 2), ["CCU", "DEL"]);
  const kn = parseVoiceQuery("ಬೆಂಗಳೂರಿನಿಂದ ಮುಂಬೈಗೆ ನಾಳೆ", TODAY);
  assert.equal(kn.to, "BOM");
  assert.equal(kn.date, "2026-10-16");
  const ml = parseVoiceQuery("കൊച്ചിയിൽ നിന്ന് ദുബായിലേക്ക്", TODAY);
  assert.deepEqual([ml.from, ml.to], ["COK", "DXB"]);
  const mr = parseVoiceQuery("पुण्याहून दिल्लीला उद्या", TODAY);
  assert.equal(mr.to, "DEL");
  assert.equal(mr.date, "2026-10-16");
});

test("IATA codes and native digits", () => {
  const q = parseVoiceQuery("MAA to DEL २ यात्री", TODAY);
  assert.deepEqual([q.from, q.to, q.pax], ["MAA", "DEL", 2]);
});

test("Nothing recognisable", () => {
  assert.deepEqual(parseVoiceQuery("hello there", TODAY), {});
});
