// Localised city names - used for display and, just as importantly, so voice
// search can understand "சென்னை", "दिल्ली" or "دبي" spoken in any language.
// Unlisted languages/cities fall back to the English city name.
// Spoken aliases (common alternative names) are in ALIASES below.

type CityTable = Record<string, Partial<Record<string, string>>>;

export const CITY_NAMES: CityTable = {
  DEL: { ta: "டெல்லி", hi: "दिल्ली", te: "ఢిల్లీ", kn: "ದೆಹಲಿ", ml: "ഡൽഹി", bn: "দিল্লি", mr: "दिल्ली", es: "Delhi", fr: "Delhi", ar: "دلهي" },
  BOM: { ta: "மும்பை", hi: "मुंबई", te: "ముంబై", kn: "ಮುಂಬೈ", ml: "മുംബൈ", bn: "মুম্বই", mr: "मुंबई", es: "Bombay", fr: "Bombay", ar: "مومباي" },
  BLR: { ta: "பெங்களூரு", hi: "बेंगलुरु", te: "బెంగళూరు", kn: "ಬೆಂಗಳೂರು", ml: "ബെംഗളൂരു", bn: "বেঙ্গালুরু", mr: "बंगळुरू", es: "Bangalore", fr: "Bangalore", ar: "بنغالور" },
  MAA: { ta: "சென்னை", hi: "चेन्नई", te: "చెన్నై", kn: "ಚೆನ್ನೈ", ml: "ചെന്നൈ", bn: "চেন্নাই", mr: "चेन्नई", es: "Chennai", fr: "Chennai", ar: "تشيناي" },
  HYD: { ta: "ஹைதராபாத்", hi: "हैदराबाद", te: "హైదరాబాద్", kn: "ಹೈದರಾಬಾದ್", ml: "ഹൈദരാബാദ്", bn: "হায়দ্রাবাদ", mr: "हैदराबाद", es: "Hyderabad", fr: "Hyderabad", ar: "حيدر أباد" },
  CCU: { ta: "கொல்கத்தா", hi: "कोलकाता", te: "కోల్‌కతా", kn: "ಕೋಲ್ಕತ್ತಾ", ml: "കൊൽക്കത്ത", bn: "কলকাতা", mr: "कोलकाता", es: "Calcuta", fr: "Calcutta", ar: "كولكاتا" },
  COK: { ta: "கொச்சி", hi: "कोच्चि", te: "కొచ్చి", kn: "ಕೊಚ್ಚಿ", ml: "കൊച്ചി", bn: "কোচি", mr: "कोची", es: "Cochín", fr: "Cochin", ar: "كوتشي" },
  GOI: { ta: "கோவா", hi: "गोवा", te: "గోవా", kn: "ಗೋವಾ", ml: "ഗോവ", bn: "গোয়া", mr: "गोवा", es: "Goa", fr: "Goa", ar: "غوا" },
  AMD: { ta: "அகமதாபாத்", hi: "अहमदाबाद", te: "అహ్మదాబాద్", kn: "ಅಹಮದಾಬಾದ್", ml: "അഹമ്മദാബാദ്", bn: "আহমেদাবাদ", mr: "अहमदाबाद", es: "Ahmedabad", fr: "Ahmedabad", ar: "أحمد آباد" },
  PNQ: { ta: "புனே", hi: "पुणे", te: "పూణే", kn: "ಪುಣೆ", ml: "പൂനെ", bn: "পুনে", mr: "पुणे", es: "Pune", fr: "Pune", ar: "بونه" },
  JAI: { ta: "ஜெய்ப்பூர்", hi: "जयपुर", te: "జైపూర్", kn: "ಜೈಪುರ", ml: "ജയ്പൂർ", bn: "জয়পুর", mr: "जयपूर", es: "Jaipur", fr: "Jaipur", ar: "جايبور" },
  LKO: { ta: "லக்னோ", hi: "लखनऊ", te: "లక్నో", kn: "ಲಕ್ನೋ", ml: "ലഖ്നൗ", bn: "লখনউ", mr: "लखनौ", es: "Lucknow", fr: "Lucknow", ar: "لكناو" },
  TRV: { ta: "திருவனந்தபுரம்", hi: "तिरुवनंतपुरम", te: "తిరువనంతపురం", kn: "ತಿರುವನಂತಪುರ", ml: "തിരുവനന്തപുരം", bn: "তিরুবনন্তপুরম", mr: "तिरुवनंतपुरम", es: "Thiruvananthapuram", fr: "Thiruvananthapuram", ar: "ثيروفانانثابورام" },
  CJB: { ta: "கோயம்புத்தூர்", hi: "कोयंबटूर", te: "కోయంబత్తూరు", kn: "ಕೊಯಮತ್ತೂರು", ml: "കോയമ്പത്തൂർ", bn: "কোয়েম্বাটুর", mr: "कोइंबतूर", es: "Coimbatore", fr: "Coimbatore", ar: "كويمباتور" },
  IXM: { ta: "மதுரை", hi: "मदुरै", te: "మదురై", kn: "ಮಧುರೈ", ml: "മധുര", bn: "মাদুরাই", mr: "मदुराई", es: "Madurai", fr: "Madurai", ar: "مادوراي" },
  GAU: { ta: "குவாஹாத்தி", hi: "गुवाहाटी", te: "గౌహతి", kn: "ಗುವಾಹಟಿ", ml: "ഗുവാഹത്തി", bn: "গুয়াহাটি", mr: "गुवाहाटी", es: "Guwahati", fr: "Guwahati", ar: "جواهاتي" },
  VTZ: { ta: "விசாகப்பட்டினம்", hi: "विशाखापत्तनम", te: "విశాఖపట్నం", kn: "ವಿಶಾಖಪಟ್ಟಣ", ml: "വിശാഖപട്ടണം", bn: "বিশাখাপত্তনম", mr: "विशाखापट्टणम", es: "Visakhapatnam", fr: "Visakhapatnam", ar: "فيساخاباتنام" },
  DXB: { ta: "துபாய்", hi: "दुबई", te: "దుబాయ్", kn: "ದುಬೈ", ml: "ദുബായ്", bn: "দুবাই", mr: "दुबई", es: "Dubái", fr: "Dubaï", ar: "دبي" },
  AUH: { ta: "அபுதாபி", hi: "अबू धाबी", te: "అబుదాబి", kn: "ಅಬುಧಾಬಿ", ml: "അബുദാബി", bn: "আবুধাবি", mr: "अबू धाबी", es: "Abu Dabi", fr: "Abou Dabi", ar: "أبوظبي" },
  SHJ: { ta: "ஷார்ஜா", hi: "शारजाह", te: "షార్జా", kn: "ಶಾರ್ಜಾ", ml: "ഷാർജ", bn: "শারজাহ", mr: "शारजाह", es: "Sharjah", fr: "Charjah", ar: "الشارقة" },
  DOH: { ta: "தோஹா", hi: "दोहा", te: "దోహా", kn: "ದೋಹಾ", ml: "ദോഹ", bn: "দোহা", mr: "दोहा", es: "Doha", fr: "Doha", ar: "الدوحة" },
  SIN: { ta: "சிங்கப்பூர்", hi: "सिंगापुर", te: "సింగపూర్", kn: "ಸಿಂಗಾಪುರ", ml: "സിംഗപ്പൂർ", bn: "সিঙ্গাপুর", mr: "सिंगापूर", es: "Singapur", fr: "Singapour", ar: "سنغافورة" },
  KUL: { ta: "கோலாலம்பூர்", hi: "कुआलालंपुर", te: "కౌలాలంపూర్", kn: "ಕೌಲಾಲಂಪುರ", ml: "ക്വാലാലംപൂർ", bn: "কুয়ালালামপুর", mr: "क्वालालंपूर", es: "Kuala Lumpur", fr: "Kuala Lumpur", ar: "كوالالمبور" },
  BKK: { ta: "பாங்காக்", hi: "बैंकॉक", te: "బ్యాంకాక్", kn: "ಬ್ಯಾಂಕಾಕ್", ml: "ബാങ്കോക്ക്", bn: "ব্যাংকক", mr: "बँकॉक", es: "Bangkok", fr: "Bangkok", ar: "بانكوك" },
  CMB: { ta: "கொழும்பு", hi: "कोलंबो", te: "కొలంబో", kn: "ಕೊಲಂಬೊ", ml: "കൊളംബോ", bn: "কলম্বো", mr: "कोलंबो", es: "Colombo", fr: "Colombo", ar: "كولومبو" },
  LHR: { ta: "லண்டன்", hi: "लंदन", te: "లండన్", kn: "ಲಂಡನ್", ml: "ലണ്ടൻ", bn: "লন্ডন", mr: "लंडन", es: "Londres", fr: "Londres", ar: "لندن" },
  CDG: { ta: "பாரிஸ்", hi: "पेरिस", te: "పారిస్", kn: "ಪ್ಯಾರಿಸ್", ml: "പാരീസ്", bn: "প্যারিস", mr: "पॅरिस", es: "París", fr: "Paris", ar: "باريس" },
  JFK: { ta: "நியூயார்க்", hi: "न्यूयॉर्क", te: "న్యూయార్క్", kn: "ನ್ಯೂಯಾರ್ಕ್", ml: "ന്യൂയോർക്ക്", bn: "নিউ ইয়র্ক", mr: "न्यूयॉर्क", es: "Nueva York", fr: "New York", ar: "نيويورك" },
};

/** Extra spoken names recognised by voice search (any language). */
export const ALIASES: Record<string, string[]> = {
  DEL: ["new delhi", "dilli", "நியூ டெல்லி", "नई दिल्ली", "ديلهي", "نيودلهي"],
  BOM: ["bombay", "mumbai", "बॉम्बे", "பம்பாய்", "مومباى"],
  BLR: ["bangalore", "bengaluru", "bengalore", "பெங்களூர்", "बैंगलोर", "బెంగుళూరు", "ಬೆಂಗಳೂರ್"],
  MAA: ["madras", "சென்னையில்", "मद्रास"],
  CCU: ["calcutta", "কোলকাতা", "कलकत्ता"],
  COK: ["cochin", "kochi", "ernakulam", "കൊച്ചിൻ"],
  TRV: ["trivandrum", "thiruvananthapuram", "ട്രിവാൻഡ്രം"],
  CJB: ["kovai", "கோவை"],
  VTZ: ["vizag", "visakhapatnam", "వైజాగ్", "विजाग"],
  GAU: ["gauhati"],
  PNQ: ["poona"],
  LHR: ["heathrow"],
  JFK: ["new york city", "nyc"],
  CDG: ["paris"],
  KUL: ["kl"],
  SIN: ["singapura"],
};

export function cityName(code: string, englishCity: string, lang: string): string {
  return CITY_NAMES[code]?.[lang] ?? englishCity;
}
