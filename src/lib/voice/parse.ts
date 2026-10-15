// Turns a spoken/typed sentence into a flight search, in any supported
// language: "flights from Chennai to Delhi next Friday",
// "சென்னையிலிருந்து டெல்லிக்கு நாளை", "दिल्ली से मुंबई कल 2 यात्री बिज़नेस",
// "vuelos de Madrid... ", "رحلات من دبي إلى مومباي غدا".
//
// Strategy: find every city mention (English names, IATA codes, localised
// names, aliases), then decide which is origin vs destination from the
// language's from/to markers, falling back to spoken order. Dates and
// passengers are matched from small per-language word lists.
import { AIRPORTS } from "../sim/airports.ts";
import { ALIASES, CITY_NAMES } from "../../i18n/cities.ts";
import { addDays, dayOfWeek } from "../sim/dates.ts";

export interface VoiceQuery {
  from?: string;
  to?: string;
  date?: string;
  pax?: number;
  cabin?: "economy" | "business";
}

interface CityHit {
  code: string;
  start: number;
  end: number;
}

// Unicode digit sets -> ASCII
const DIGIT_BLOCKS = [0x0966, 0x09e6, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0660, 0x06f0];

export function normalizeDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const block = DIGIT_BLOCKS.find((b) => c >= b && c <= b + 9);
    out += block !== undefined ? String(c - block) : ch;
  }
  return out;
}

function normalize(s: string): string {
  return normalizeDigits(s)
    .toLowerCase()
    .normalize("NFC")
    .replace(/[.,!?¿¡;:"'“”«»()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let cityIndex: Array<{ name: string; code: string }> | null = null;

function cityNames(): Array<{ name: string; code: string }> {
  if (cityIndex) return cityIndex;
  const list: Array<{ name: string; code: string }> = [];
  const add = (name: string, code: string) => {
    const n = name.toLowerCase();
    list.push({ name: n, code });
    // Indic languages inflect the city itself: ದುಬಾಯ್ -> ದುಬಾಯಿಲೇಕ್ಕ್,
    // ಬೆಂಗಳೂರು -> ಬೆಂಗಳೂರಿನಿಂದ, पुणे -> पुण्याहून. Also index the stem
    // without its final vowel sign / virama.
    if (!LATIN.test(n)) {
      const stem = n.replace(/\p{M}+$/u, "");
      if (stem !== n && stem.length >= 3) list.push({ name: stem, code });
    }
  };
  for (const a of AIRPORTS) {
    add(a.city, a.code);
    for (const n of Object.values(CITY_NAMES[a.code] ?? {})) if (n) add(n, a.code);
    for (const n of ALIASES[a.code] ?? []) add(n, a.code);
  }
  // Longest names first so "new delhi" wins over "delhi", "abu dhabi" over "dhabi".
  list.sort((x, y) => y.name.length - x.name.length);
  cityIndex = list;
  return list;
}

const LATIN = /^[a-z]/;

function findCities(text: string): CityHit[] {
  const hits: CityHit[] = [];
  const taken: boolean[] = new Array(text.length).fill(false);
  for (const { name, code } of cityNames()) {
    let from = 0;
    while (true) {
      const i = text.indexOf(name, from);
      if (i < 0) break;
      from = i + 1;
      const end = i + name.length;
      // Latin names must match whole words; Indic/Arabic names may carry
      // attached case endings ("சென்னையிலிருந்து", "दिल्ली से", "لدبي").
      if (LATIN.test(name)) {
        const before = text[i - 1];
        const after = text[end];
        if ((before && /[a-z0-9]/.test(before)) || (after && /[a-z0-9]/.test(after))) continue;
      }
      if (taken.slice(i, end).some(Boolean)) continue;
      for (let k = i; k < end; k++) taken[k] = true;
      hits.push({ code, start: i, end });
    }
  }
  // IATA codes spoken/typed as e.g. "MAA to DEL"
  for (const m of text.matchAll(/\b([a-z]{3})\b/g)) {
    const code = m[1].toUpperCase();
    if (AIRPORTS.some((a) => a.code === code) && !taken[m.index!] && !["the", "and", "for"].includes(m[1])) {
      hits.push({ code, start: m.index!, end: m.index! + 3 });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  // Drop repeats of the same city.
  return hits.filter((h, i) => hits.findIndex((x) => x.code === h.code) === i);
}

// Origin markers that appear BEFORE the city (from Chennai, de Madrid, من دبي)
const FROM_BEFORE = ["from", "de", "desde", "depuis", "du", "des", "من", "out of", "leaving"];
// Destination markers BEFORE the city (to Delhi, a Delhi, à Paris, إلى دبي)
const TO_BEFORE = ["to", "a", "al", "à", "au", "aux", "pour", "hacia", "para", "vers", "إلى", "الى", "towards", "into"];
// Origin markers AFTER the city (Indic postpositions: दिल्ली से, சென்னையிலிருந்து)
const FROM_AFTER = ["से", "पासून", "हून", "थेके", "থেকে", "నుండి", "నుంచి", "ಇಂದ", "ರಿಂದ", "ನಿಂದ", "ಯಿಂದ", "ಿಂದ", "இலிருந்து", "லிருந்து", "இருந்து", "ருந்து", "ൽ നിന്ന്", "ിൽ നിന്ന്", "നിന്ന്", "ഇൽ നിന്ന്"];
// Destination markers AFTER the city (मुंबई को, दिल्ली तक, டெல்லிக்கு, ಗೆ)
const TO_AFTER = ["को", "तक", "के लिए", "ला", "कडे", "ते", "তে", "এ", "য়", "কে", "కి", "కు", "కు వెళ్ళే", "ಗೆ", "ಕ್ಕೆ", "க்கு", "கு", "ക്ക്", "ലേക്ക്", "യിലേക്ക്", "ിലേക്ക്"];

function roleOf(text: string, hit: CityHit): "from" | "to" | null {
  const before = text.slice(Math.max(0, hit.start - 12), hit.start).trim();
  const lastWord = before.split(" ").pop() ?? "";
  const lastTwo = before.split(" ").slice(-2).join(" ");
  if (FROM_BEFORE.includes(lastWord) || FROM_BEFORE.includes(lastTwo)) return "from";
  if (TO_BEFORE.includes(lastWord) || TO_BEFORE.includes(lastTwo)) return "to";
  // Postpositions: either glued to the city ("டெல்லிக்கு", "दिल्लीला") or
  // the following word ("दिल्ली से", "কলকাতা থেকে", "കൊച്ചിയിൽ നിന്ന്").
  const rest = text.slice(hit.end);
  const attached = /^\S*/.exec(rest)![0];
  const following = rest.slice(attached.length).trim().split(" ");
  const next1 = following[0] ?? "";
  const next2 = following.slice(0, 2).join(" ");
  const matches = (m: string) =>
    (attached && (attached === m || attached.endsWith(m))) || next1 === m || next2 === m || (m.length > 3 && next1.startsWith(m));
  // Malayalam "X-ൽ നിന്ന്": the case ending is on X, "നിന്ന്" is the next word
  if (FROM_AFTER.some(matches)) return "from";
  if (TO_AFTER.some(matches)) return "to";
  return null;
}

// Weekday names (Monday = 0) in every supported language.
const WEEKDAYS: string[][] = [
  ["monday", "lunes", "lundi", "सोमवार", "திங்கள்", "సోమవారం", "ಸೋಮವಾರ", "തിങ്കൾ", "সোমবার", "الاثنين", "الإثنين"],
  ["tuesday", "martes", "mardi", "मंगलवार", "मंगळवार", "செவ்வாய்", "మంగళవారం", "ಮಂಗಳವಾರ", "ചൊവ്വ", "মঙ্গলবার", "الثلاثاء"],
  ["wednesday", "miércoles", "miercoles", "mercredi", "बुधवार", "புதன்", "బుధవారం", "ಬುಧವಾರ", "ബുധൻ", "বুধবার", "الأربعاء", "الاربعاء"],
  ["thursday", "jueves", "jeudi", "गुरुवार", "वियाझन", "வியாழன்", "గురువారం", "ಗುರುವಾರ", "വ്യാഴം", "বৃহস্পতিবার", "الخميس"],
  ["friday", "viernes", "vendredi", "शुक्रवार", "வெள்ளி", "శుక్రవారం", "ಶುಕ್ರವಾರ", "വെള്ളി", "শুক্রবার", "الجمعة"],
  ["saturday", "sábado", "sabado", "samedi", "शनिवार", "சனி", "శనివారం", "ಶನಿವಾರ", "ശനി", "শনিবার", "السبت"],
  ["sunday", "domingo", "dimanche", "रविवार", "ஞாயிறு", "ఆదివారం", "ಭಾನುವಾರ", "ഞായർ", "রবিবার", "الأحد", "الاحد"],
];

const NEXT_WORDS = ["next", "próximo", "proximo", "prochain", "prochaine", "अगले", "अगला", "पुढच्या", "पुढील", "அடுத்த", "వచ్చే", "ಮುಂದಿನ", "അടുത്ത", "আগামী", "القادم", "القادمة", "المقبل"];
const TODAY = ["today", "tonight", "hoy", "aujourd'hui", "aujourd hui", "आज", "இன்று", "ఈరోజు", "ఈ రోజు", "ಇಂದು", "ഇന്ന്", "আজ", "اليوم"];
const TOMORROW = ["tomorrow", "mañana", "manana", "demain", "कल", "उद्या", "நாளை", "రేపు", "ನಾಳೆ", "നാളെ", "আগামীকাল", "কাল", "غدا", "غدًا", "بكرة"];
const DAY_AFTER = ["day after tomorrow", "pasado mañana", "après-demain", "après demain", "परसों", "परवा", "நாளை மறுநாள்", "ఎల్లుండి", "ನಾಡಿದ್ದು", "മറ്റന്നാൾ", "পরশু", "بعد غد"];
const MONTHS: string[][] = [
  ["january", "jan", "enero", "janvier", "जनवरी", "जानेवारी", "ஜனவரி", "జనవరి", "ಜನವರಿ", "ജനുവരി", "জানুয়ারি", "يناير"],
  ["february", "feb", "febrero", "février", "फरवरी", "फेब्रुवारी", "பிப்ரவரி", "ఫిబ్రవరి", "ಫೆಬ್ರವರಿ", "ഫെബ്രുവരി", "ফেব্রুয়ারি", "فبراير"],
  ["march", "mar", "marzo", "mars", "मार्च", "மார்ச்", "మార్చి", "ಮಾರ್ಚ್", "മാർച്ച്", "মার্চ", "مارس"],
  ["april", "apr", "abril", "avril", "अप्रैल", "एप्रिल", "ஏப்ரல்", "ఏప్రిల్", "ಏಪ್ರಿಲ್", "ഏപ്രിൽ", "এপ্রিল", "أبريل"],
  ["may", "mayo", "mai", "मई", "मे", "மே", "మే", "ಮೇ", "മേയ്", "মে", "مايو"],
  ["june", "jun", "junio", "juin", "जून", "ஜூன்", "జూన్", "ಜೂನ್", "ജൂൺ", "জুন", "يونيو"],
  ["july", "jul", "julio", "juillet", "जुलाई", "जुलै", "ஜூலை", "జూలై", "ಜುಲೈ", "ജൂലൈ", "জুলাই", "يوليو"],
  ["august", "aug", "agosto", "août", "aout", "अगस्त", "ऑगस्ट", "ஆகஸ்ட்", "ఆగస్టు", "ಆಗಸ್ಟ್", "ഓഗസ്റ്റ്", "আগস্ট", "أغسطس"],
  ["september", "sep", "sept", "septiembre", "septembre", "सितंबर", "सप्टेंबर", "செப்டம்பர்", "సెప్టెంబర్", "ಸೆಪ್ಟೆಂಬರ್", "സെപ്റ്റംബർ", "সেপ্টেম্বর", "سبتمبر"],
  ["october", "oct", "octubre", "octobre", "अक्टूबर", "ऑक्टोबर", "அக்டோபர்", "అక్టోబర్", "ಅಕ್ಟೋಬರ್", "ഒക്ടോബർ", "অক্টোবর", "أكتوبر"],
  ["november", "nov", "noviembre", "novembre", "नवंबर", "नोव्हेंबर", "நவம்பர்", "నవంబర్", "ನವೆಂಬರ್", "നവംബർ", "নভেম্বর", "نوفمبر"],
  ["december", "dec", "diciembre", "décembre", "दिसंबर", "डिसेंबर", "டிசம்பர்", "డిసెంబర్", "ಡಿಸೆಂಬರ್", "ഡിസംബർ", "ডিসেম্বর", "ديسمبر"],
];
const BUSINESS = ["business", "negocios", "affaires", "बिज़नेस", "बिजनेस", "बिझनेस", "பிசினஸ்", "బిజినెస్", "ಬಿಸಿನೆಸ್", "ബിസിനസ്", "বিজনেস", "رجال الأعمال", "الأعمال", "بزنس"];
const PAX_WORDS = ["passenger", "passengers", "people", "persons", "adults", "tickets", "pasajeros", "personas", "passagers", "personnes", "यात्री", "लोग", "प्रवासी", "பயணிகள்", "பேர்", "ప్రయాణికులు", "మంది", "ಪ್ರಯಾಣಿಕರು", "ಜನ", "യാത്രക്കാർ", "പേർ", "যাত্রী", "জন", "ركاب", "مسافرين", "أشخاص", "اشخاص"];
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "दोन": 2,
  "ஒரு": 1, "இரண்டு": 2, "மூன்று": 3, "நான்கு": 4,
  "ఒక": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4,
  "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4,
  "ഒരു": 1, "രണ്ട്": 2, "മൂന്ന്": 3, "നാല്": 4,
  "দুই": 2, "তিন": 3, "চার": 4,
  "واحد": 1, "اثنين": 2, "اثنان": 2, "ثلاثة": 3, "أربعة": 4,
};

function includesAny(text: string, words: string[]): string | null {
  for (const w of words) {
    const re = LATIN.test(w) ? new RegExp(`(^|[^a-zà-ÿ])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-zà-ÿ])`) : null;
    if (re ? re.test(text) : text.includes(w)) return w;
  }
  return null;
}

function parseDate(text: string, today: string): string | undefined {
  if (includesAny(text, DAY_AFTER)) return addDays(today, 2);
  if (includesAny(text, TOMORROW)) return addDays(today, 1);
  if (includesAny(text, TODAY)) return today;
  // "in 5 days"
  const inDays = /(?:in|en|dans)\s+(\d{1,3})\s+(?:days|días|dias|jours)/.exec(text);
  if (inDays) return addDays(today, Number(inDays[1]));
  // explicit "12 december" / "december 12" / "12/12"
  const nowYear = Number(today.slice(0, 4));
  for (let m = 0; m < 12; m++) {
    for (const name of MONTHS[m]) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(\\d{1,2})\\s*(?:st|nd|rd|th|de|ta)?\\s*${esc}|${esc}\\s*(\\d{1,2})(?!\\d)`);
      const mm = re.exec(text);
      if (mm) {
        const day = Number(mm[1] ?? mm[2]);
        if (day >= 1 && day <= 31) {
          let iso = `${nowYear}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          if (iso < today) iso = `${nowYear + 1}-${iso.slice(5)}`;
          return iso;
        }
      }
    }
  }
  const slash = /\b(\d{1,2})[/-](\d{1,2})\b/.exec(text);
  if (slash) {
    const d = Number(slash[1]);
    const mo = Number(slash[2]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      let iso = `${nowYear}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (iso < today) iso = `${nowYear + 1}-${iso.slice(5)}`;
      return iso;
    }
  }
  // weekdays: "friday" = coming Friday, "next friday" = the one after this week
  for (let d = 0; d < 7; d++) {
    if (includesAny(text, WEEKDAYS[d])) {
      const todayDow = dayOfWeek(today);
      let delta = (d - todayDow + 7) % 7;
      if (delta === 0) delta = 7;
      if (includesAny(text, NEXT_WORDS) && delta < 3) delta += 7;
      return addDays(today, delta);
    }
  }
  if (/(next week|semana que viene|próxima semana|semaine prochaine|अगले हफ्ते|अगले सप्ताह|அடுத்த வாரம்|వచ్చే వారం|ಮುಂದಿನ ವಾರ|അടുത്ത ആഴ്ച|আগামী সপ্তাহ|الأسبوع القادم)/.test(text)) {
    return addDays(today, 7);
  }
  return undefined;
}

function parsePax(text: string): number | undefined {
  for (const w of PAX_WORDS) {
    const i = text.indexOf(w);
    if (i < 0) continue;
    const before = text.slice(Math.max(0, i - 14), i).trim().split(" ");
    const after = text.slice(i + w.length, i + w.length + 10).trim().split(" ");
    for (const tok of [before[before.length - 1], after[0]]) {
      if (!tok) continue;
      if (/^\d$/.test(tok)) return Math.min(9, Math.max(1, Number(tok)));
      if (NUMBER_WORDS[tok]) return NUMBER_WORDS[tok];
    }
  }
  const m = /(?:for|para|pour)\s+(\d|one|two|three|four|five|dos|tres|deux|trois)\b/.exec(text);
  if (m) return /^\d$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
  return undefined;
}

export function parseVoiceQuery(raw: string, today: string): VoiceQuery {
  const text = normalize(raw);
  const out: VoiceQuery = {};
  const cities = findCities(text);
  if (cities.length >= 1) {
    const roles = cities.map((c) => roleOf(text, c));
    const fromIdx = roles.indexOf("from");
    const toIdx = roles.indexOf("to");
    if (fromIdx >= 0) out.from = cities[fromIdx].code;
    if (toIdx >= 0 && toIdx !== fromIdx) out.to = cities[toIdx].code;
    // fill the remaining role(s) by spoken order
    const rest = cities.filter((c) => c.code !== out.from && c.code !== out.to);
    if (!out.from && !out.to) {
      if (rest[0]) out[cities.length === 1 ? "to" : "from"] = rest[0].code;
      if (rest[1]) out.to = rest[1].code;
    } else if (!out.from && rest[0]) out.from = rest[0].code;
    else if (!out.to && rest[0]) out.to = rest[0].code;
  }
  const date = parseDate(text, today);
  if (date) out.date = date;
  const pax = parsePax(text);
  if (pax) out.pax = pax;
  if (includesAny(text, BUSINESS)) out.cabin = "business";
  return out;
}
