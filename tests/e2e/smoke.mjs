// End-to-end smoke test with headless Chrome (no extra npm packages).
//
//   BASE_URL=http://localhost:3100 node tests/e2e/smoke.mjs
//
// Checks every page on desktop + mobile + dark mode, all 11 languages
// (incl. Arabic RTL), the voice fallback, search filters/sorting, budget
// mode, prediction, watchlist alerts, booking + PDF e-ticket and My trips.
// Screenshots go to tests/e2e/output/ (git-ignored).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "output", process.env.OUT_NAME ?? "local");
mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.SHOTS !== "0";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const iso = (days) => new Date(Date.now() + days * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10);
const DATE = iso(21);

const { newPage, close } = await launch({ port: Number(process.env.CDP_PORT ?? 9333) });

// Watchdog: never hang CI / the terminal if Chrome stops responding.
const WATCHDOG_MS = Number(process.env.E2E_TIMEOUT_MS ?? 15 * 60_000);
const watchdog = setTimeout(async () => {
  console.error(`E2E watchdog: aborting after ${WATCHDOG_MS / 1000}s`);
  check("watchdog timeout", false, "Chrome stopped responding");
  await close().catch(() => {});
  process.exit(2);
}, WATCHDOG_MS);
watchdog.unref();

let pageSeq = 0;
async function freshPage({ width = 1366, height = 900, mobile = false, dark = false, lang = "en", noVoice = false, clear = true } = {}) {
  const p = await newPage();
  await p.viewport(width, height, mobile);
  // Reset storage once per test page (keyed so later navigations keep state).
  const key = `sf-init-${++pageSeq}`;
  await p.addInitScript(`
    try {
      if (!localStorage.getItem('${key}')) {
        ${clear ? "localStorage.clear();" : ""}
        localStorage.setItem('${key}', '1');
        localStorage.setItem('skyfare.theme', '${dark ? "dark" : "light"}');
        localStorage.setItem('skyfare.lang', '${lang}');
      }
    } catch (e) {}
    ${noVoice ? "try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true }); Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }); } catch (e) {}" : ""}
  `);
  return p;
}

try {
  // ---------- 1. Every page, desktop light ----------
  const pages = ["/", `/results?from=MAA&to=DEL&date=${DATE}&pax=1&cabin=economy`, `/budget?from=MAA&to=DEL&date=${DATE}&pax=1&cabin=economy`, `/predict?from=MAA&to=DEL&date=${DATE}&cabin=economy`, "/watchlist", "/trips", "/dashboard", "/about", "/book", "/does-not-exist"];
  const views = [
    { tag: "desktop", width: 1366, height: 900 },
    { tag: "mobile", width: 390, height: 844, mobile: true },
    { tag: "desktop-dark", width: 1366, height: 900, dark: true },
    { tag: "mobile-dark", width: 390, height: 844, mobile: true, dark: true },
  ];
  for (const v of process.env.SKIP_PAGES ? [] : views) {
    const p = await freshPage(v);
    for (const path of pages) {
      p.errors.length = 0;
      await p.goto(BASE + path, { wait: 900 });
      const info = await p.eval(`({
        h1: document.querySelector('h1')?.innerText ?? '',
        dark: document.documentElement.classList.contains('dark'),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        brand: document.body.innerText.includes('SkyFare') && document.body.innerText.includes('Fly smart. Pay less.'),
        imgsBroken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
      })`);
      const name = path === "/" ? "home" : path.split("?")[0].slice(1).replace(/\//g, "-");
      if (SHOTS && (v.tag === "desktop" || v.tag === "mobile" || ["home", "results", "predict", "dashboard"].includes(name))) await p.screenshot(join(OUT, `${v.tag}-${name}.png`), { fullPage: v.tag.startsWith("desktop") });
      const ok = info.brand && info.dark === Boolean(v.dark) && info.overflow <= 1 && info.imgsBroken.length === 0 && p.errors.length === 0;
      check(`[${v.tag}] ${name}`, ok, ok ? info.h1.slice(0, 50) : JSON.stringify({ ...info, errors: p.errors.slice(0, 3) }));
    }
    await p.close();
  }

  // ---------- 2. Search: results, filters, sorting ----------
  {
    const p = await freshPage();
    await p.goto(BASE + "/");
    await p.waitFor(`document.querySelector('[data-testid=search-submit]')`);
    await p.click("[data-testid=search-submit]");
    await p.waitFor(`location.pathname === '/results' && document.querySelectorAll('[data-testid=flight-card]').length > 0`, 15000);
    const n = await p.count("[data-testid=flight-card]");
    check("search returns flights", n > 0, `${n} flights`);
    const prices = await p.eval(`[...document.querySelectorAll('[data-testid=flight-card]')].map(e => +e.dataset.price)`);
    check("default sort = cheapest (ascending price)", prices.every((x, i) => i === 0 || prices[i - 1] <= x));
    await p.click("[data-testid=sort-fastest]");
    const durs = await p.eval(`[...document.querySelectorAll('[data-testid=flight-card]')].map(e => +e.dataset.duration)`);
    check("sort fastest", durs.every((x, i) => i === 0 || durs[i - 1] <= x));
    await p.click("[data-testid=sort-best]");
    check("sort best value shows badge", (await p.text("[data-testid=flight-list]")).includes("Best value"));
    await p.click("[data-testid=stops-0]");
    const stops = await p.eval(`[...document.querySelectorAll('[data-testid=flight-card]')].map(e => +e.dataset.stops)`);
    check("filter non-stop", stops.length > 0 && stops.every((s) => s === 0), `${stops.length} shown`);
    const firstAirline = await p.eval(`document.querySelector('[data-testid^=airline-]').dataset.testid.slice(8)`);
    await p.click(`[data-testid=airline-${firstAirline}]`);
    const airlines = await p.eval(`[...document.querySelectorAll('[data-testid=flight-card]')].map(e => e.dataset.airline)`);
    check("filter airline", airlines.every((a) => a === firstAirline), `${firstAirline}: ${airlines.length}`);
    await p.click("[data-testid=reset-filters]");
    const minP = Math.min(...prices);
    await p.fill("[data-testid=price-filter]", String(minP + 300));
    const filtered = await p.eval(`[...document.querySelectorAll('[data-testid=flight-card]')].map(e => +e.dataset.price)`);
    check("filter max price", filtered.every((x) => x <= minP + 300), `${filtered.length} <= ${minP + 300}`);
    await p.click("[data-testid=reset-filters]");
    await p.click("[data-testid=time-night]").catch(() => {});
    await p.click("[data-testid=reset-filters]").catch(() => {});
    // track route -> watchlist
    await p.click("[data-testid=track-route]");
    check("track route from results", (await p.eval(`document.body.innerText`)).includes("watchlist"));
    // invalid search
    await p.goto(BASE + `/results?from=MAA&to=MAA&date=${DATE}&pax=1&cabin=economy`);
    check("same-airport error message", (await p.eval(`document.body.innerText`)).includes("must be different"));
    await p.close();
  }

  // ---------- 3. Budget mode ----------
  {
    const p = await freshPage();
    await p.goto(BASE + `/budget?from=MAA&to=DEL&date=${DATE}&pax=1&cabin=economy`, { wait: 1500 });
    await p.waitFor(`document.querySelector('[data-testid=cheapest-option]') && document.querySelector('[data-testid=nearby-dates] li')`, 15000);
    check("budget: cheapest option shown", Boolean(await p.text("[data-testid=cheapest-option]")));
    const cal = await p.count("[data-testid=fare-calendar] [data-level=low]");
    check("budget: fare calendar low days", cal > 3, `${cal} low days`);
    check("budget: cheapest days list", (await p.count("[data-testid=cheapest-days] button")) >= 3);
    check("budget: nearby dates", (await p.count("[data-testid=nearby-dates] li")) > 0);
    const cheapest = await p.eval(`Math.min(...[...document.querySelectorAll('[data-testid=flight-card]')].map(e => +e.dataset.price))`);
    await p.fill("[data-testid=budget-input]", String(cheapest + 400));
    await sleep(400);
    const within = await p.eval(`[...document.querySelectorAll('[data-testid=flight-card]')].map(e => +e.dataset.price)`);
    check("budget: max budget filters results", within.length > 0 && within.every((x) => x <= cheapest + 400), `${within.length} flights <= ${cheapest + 400}`);
    await p.fill("[data-testid=budget-input]", "500");
    await sleep(400);
    check("budget: none-within message", (await p.text("[data-testid=budget-summary]"))?.includes("No flights within"));
    await p.fill("[data-testid=budget-input]", "");
    // calendar click changes date
    const day = await p.eval(`document.querySelector('[data-testid=fare-calendar] [data-level=low]').dataset.testid.slice(4)`);
    await p.click(`[data-testid=cal-${day}]`);
    await p.waitFor(`location.search.includes('date=${day}')`, 8000);
    check("budget: calendar day selects date", true, day);
    // nearby airports (Delhi region has none within 320 km in our set; Kochi has TRV, CJB)
    await p.goto(BASE + `/budget?from=BLR&to=COK&date=${DATE}&pax=1&cabin=economy`, { wait: 1500 });
    await p.waitFor(`document.querySelector('[data-testid=nearby-airports] li')`, 15000);
    check("budget: nearby airports", (await p.count("[data-testid=nearby-airports] li")) > 0);
    if (SHOTS) await p.screenshot(join(OUT, "flow-budget.png"), { fullPage: true });
    await p.close();
  }

  // ---------- 4. Prediction ----------
  {
    const p = await freshPage();
    for (const [d, label] of [[iso(10), "near"], [iso(120), "far"]]) {
      await p.goto(BASE + `/predict?from=DEL&to=BOM&date=${d}&cabin=economy`, { wait: 1200 });
      await p.waitFor(`document.querySelector('[data-testid=recommendation]')`, 15000);
      const action = await p.eval(`document.querySelector('[data-testid=recommendation]').dataset.action`);
      const conf = await p.text("[data-testid=confidence]");
      const chart = await p.count("[data-testid=forecast-chart] .recharts-line-curve, [data-testid=forecast-chart] path.recharts-curve");
      check(`predict (${label}): ${action} @ ${conf}`, ["book", "wait"].includes(action) && /\d+%/.test(conf) && chart > 0);
      if (SHOTS) await p.screenshot(join(OUT, `flow-predict-${label}.png`), { fullPage: true });
    }
    await p.close();
  }

  // ---------- 5. Watchlist + in-app alert ----------
  {
    const p = await freshPage();
    await p.goto(BASE + "/watchlist");
    check("watchlist empty state", (await p.eval(`document.body.innerText`)).includes("Your watchlist is empty"));
    await p.fill("[data-testid=target-input]", "999999"); // guaranteed below target -> alert
    await p.click("[data-testid=search-submit]");
    await p.waitFor(`document.querySelectorAll('[data-testid=watch-item]').length === 1`, 8000);
    await p.waitFor(`document.querySelector('[data-testid=history-chart] .recharts-area-area, [data-testid=history-chart] path')`, 15000);
    check("watchlist: item + history chart", true);
    await p.waitFor(`document.querySelector('[data-testid=price-alert]')`, 15000);
    check("watchlist: price drop alert shown", (await p.text("[data-testid=price-alert]")).includes("Price drop alert"));
    if (SHOTS) await p.screenshot(join(OUT, "flow-watchlist.png"), { fullPage: true });
    // alert persists & nav badge
    await p.goto(BASE + "/trips");
    await p.click("[data-testid=tab-tracked]");
    check("trips: tracked item with status", (await p.text("[data-testid=tracked-item]"))?.includes("Price below target"));
    await p.close();
  }

  // ---------- 6. Booking flow + PDF ----------
  {
    const p = await freshPage({ clear: true });
    const dl = join(OUT, "downloads");
    mkdirSync(dl, { recursive: true });
    for (const f of readdirSync(dl)) if (f.endsWith(".pdf")) statSync(join(dl, f));
    await p.setDownloadDir(dl);
    await p.goto(BASE + `/results?from=BLR&to=GOI&date=${DATE}&pax=2&cabin=economy`);
    await p.waitFor(`document.querySelector('[data-testid=select-flight]')`, 15000);
    await p.click("[data-testid=select-flight]");
    await p.waitFor(`location.pathname === '/book' && document.querySelector('[data-testid=p0-first]')`, 15000);
    // validation
    await p.click("[data-testid=book-next]");
    check("booking: validation errors", (await p.eval(`document.body.innerText`)).includes("Enter a first name"));
    for (const [i, first, last, age, g] of [[0, "Asha", "Raman", 31, "female"], [1, "Vikram", "Iyer", 34, "male"]]) {
      await p.fill(`[data-testid=p${i}-first]`, first);
      await p.fill(`[data-testid=p${i}-last]`, last);
      await p.fill(`[data-testid=p${i}-age]`, age);
      await p.click(`[data-testid=p${i}-gender-${g}]`);
    }
    await p.fill("[data-testid=email]", "asha@example.com");
    await p.fill("[data-testid=phone]", "+91 98765 43210");
    await p.click("[data-testid=book-next]");
    await p.waitFor(`document.querySelector('[data-testid=seat-map]')`);
    check("booking: seat map", (await p.count("[data-testid^=seat-]")) > 50);
    // pick first two free seats manually
    const seats = await p.eval(`[...document.querySelectorAll('[data-testid^=seat-][data-taken="0"]')].slice(0,2).map(e => e.dataset.testid)`);
    for (const s of seats) await p.click(`[data-testid=${s}]`);
    await p.click("[data-testid=book-next]");
    await p.waitFor(`document.querySelector('[data-testid=p0-meal]')`);
    const before = await p.text("[data-testid=fare-total]");
    await p.click("[data-testid=p0-meal]");
    await p.click("[data-testid=p1-bag5]");
    const after = await p.text("[data-testid=fare-total]");
    check("booking: add-ons change total", before !== after, `${before} -> ${after}`);
    await p.click("[data-testid=book-next]");
    // bad card
    await p.fill("[data-testid=card-number]", "4111 1111 1111 1112");
    await p.click("[data-testid=pay-button]");
    check("booking: invalid card rejected", (await p.eval(`document.body.innerText`)).includes("Check the card details"));
    await p.click("[data-testid=fill-test]");
    await p.click("[data-testid=pay-button]");
    await p.waitFor(`document.querySelector('[data-testid=booking-ref]')`, 15000);
    const ref = (await p.text("[data-testid=booking-ref]")).trim();
    check("booking: confirmed with reference", /^[A-Z0-9]{6}$/.test(ref), ref);
    if (SHOTS) await p.screenshot(join(OUT, "flow-booking-confirmed.png"), { fullPage: true });
    await p.click("[data-testid=download-ticket]");
    let pdf = null;
    for (let i = 0; i < 40 && !pdf; i++) {
      await sleep(250);
      pdf = readdirSync(dl).find((f) => f === `SkyFare-eticket-${ref}.pdf`);
    }
    const pdfBytes = pdf ? readFileSync(join(dl, pdf)) : null;
    check("booking: e-ticket PDF downloaded", pdfBytes && pdfBytes.subarray(0, 5).toString() === "%PDF-", pdf ? `${pdf} ${pdfBytes.length} B` : "missing");
    await p.goto(BASE + "/trips");
    check("trips: booking listed as confirmed", (await p.text("[data-testid=trip-item]"))?.includes(ref) && (await p.text("[data-testid=trip-item]")).includes("Confirmed"));
    if (SHOTS) await p.screenshot(join(OUT, "flow-trips.png"), { fullPage: true });
    await p.close();
  }

  // ---------- 7. Languages + RTL ----------
  {
    // Words from the always-visible results page (sort tab "Cheapest" + search button),
    // not the nav menu (which collapses into the burger in long languages).
    const expected = { en: "Search flights", ta: "விமானங்களைத் தேடு", hi: "उड़ानें खोजें", te: "విమానాలు శోధించండి", kn: "ವಿಮಾನಗಳನ್ನು ಹುಡುಕಿ", ml: "വിമാനങ്ങൾ തിരയുക", bn: "ফ্লাইট খুঁজুন", mr: "विमाने शोधा", es: "Buscar vuelos", fr: "Rechercher des vols", ar: "ابحث عن رحلات" };
    for (const [lang, word] of Object.entries(expected)) {
      const p = await freshPage({ lang });
      await p.goto(BASE + `/results?from=MAA&to=DEL&date=${DATE}&pax=1&cabin=economy`, { wait: 1200 });
      await p.waitFor(`document.querySelectorAll('[data-testid=flight-card]').length > 0`, 15000);
      const info = await p.eval(`({ lang: document.documentElement.lang, dir: document.documentElement.dir, text: document.body.innerText, sel: document.querySelector('[data-testid=lang-switcher]')?.value, overflow: document.documentElement.scrollWidth - window.innerWidth })`);
      const ok = info.lang === lang && info.dir === (lang === "ar" ? "rtl" : "ltr") && info.text.includes(word) && info.sel === lang && info.overflow <= 1 && p.errors.length === 0;
      check(`language ${lang} (${info.dir})`, ok, ok ? "" : JSON.stringify({ lang: info.lang, dir: info.dir, has: info.text.includes(word), errors: p.errors.slice(0, 2) }));
      if (SHOTS && ["ta", "hi", "ar"].includes(lang)) await p.screenshot(join(OUT, `lang-${lang}-results.png`));
      await p.close();
    }
    // switcher persistence
    const p = await freshPage();
    await p.goto(BASE + "/");
    await p.fill("[data-testid=lang-switcher]", "ar");
    await sleep(600);
    const afterSwitch = await p.eval(`({ dir: document.documentElement.dir, stored: localStorage.getItem('skyfare.lang') })`);
    await p.goto(BASE + "/dashboard", { wait: 1500 });
    const afterNav = await p.eval(`({ dir: document.documentElement.dir, h1: document.querySelector('h1')?.innerText })`);
    check("language switcher persists (ar, RTL)", afterSwitch.dir === "rtl" && afterSwitch.stored === "ar" && afterNav.dir === "rtl" && afterNav.h1 === "لوحة المعلومات", JSON.stringify(afterNav));
    if (SHOTS) await p.screenshot(join(OUT, "lang-ar-dashboard.png"));
    await p.close();
  }

  // ---------- 8. Voice fallback ----------
  {
    const p = await freshPage({ noVoice: true });
    await p.goto(BASE + "/");
    await p.click("[data-testid=voice-button]");
    await sleep(300);
    const msg = await p.text("[data-testid=voice-status]");
    check("voice: unsupported browser -> friendly text fallback", msg?.includes("isn't supported") && msg.includes("type"), msg);
    // search still works by typing after fallback
    await p.click("[data-testid=search-submit]");
    await p.waitFor(`location.pathname === '/results'`, 8000);
    check("voice fallback: typed search still works", true);
    await p.close();

    // Simulated recognition result (stub API) -> fields filled + auto-search
    const p2 = await freshPage({ lang: "ta" });
    // Headless Chrome has a real webkitSpeechRecognition that reports
    // "not-allowed" (no mic), so replace both constructors with a stub that
    // "hears" a Tamil sentence.
    await p2.addInitScript(`
      window.SpeechRecognition = window.webkitSpeechRecognition = class {
        start() { setTimeout(() => { this.onstart && this.onstart();
          const r = [{ 0: { transcript: 'சென்னையிலிருந்து டெல்லிக்கு நாளை' }, isFinal: true, length: 1 }];
          this.onresult && this.onresult({ resultIndex: 0, results: r });
          this.onend && this.onend(); }, 50); }
        stop() {} abort() {}
      };`);
    await p2.goto(BASE + "/");
    await p2.click("[data-testid=voice-button]");
    await p2.waitFor(`location.pathname === '/results'`, 8000);
    const q = await p2.eval(`location.search`);
    check("voice (Tamil, stubbed recognizer) -> MAA to DEL tomorrow", q.includes("from=MAA") && q.includes("to=DEL") && q.includes(`date=${iso(1)}`), q);
    await p2.close();

    // Read-aloud with no voices installed for a language -> message
    const p3 = await freshPage({ lang: "ml" });
    await p3.addInitScript(`try { Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [{ lang: 'en-US', name: 'Test', default: true }] }); } catch (e) {}`);
    await p3.goto(BASE + `/predict?from=COK&to=DXB&date=${DATE}&cabin=economy`, { wait: 1200 });
    await p3.waitFor(`document.querySelector('[data-testid=read-aloud]')`, 15000);
    await p3.click("[data-testid=read-aloud]");
    await p3.waitFor(`document.querySelector('[data-testid=tts-note]')`, 5000);
    check("read-aloud: missing language voice -> friendly message", Boolean(await p3.text("[data-testid=tts-note]")), await p3.text("[data-testid=tts-note]"));
    await p3.close();
  }
} catch (e) {
  check("unexpected error", false, e.stack ?? String(e));
} finally {
  await close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
if (failed.length) {
  console.log("Failures:\n" + failed.map((f) => ` - ${f.name}: ${f.detail}`).join("\n"));
  process.exit(1);
}
