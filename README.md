# ✈️ SkyFare — *Fly smart. Pay less.*

SkyFare is a **smart flight ticket booking tracker** (demo). It helps you find the cheapest
flights, predicts future fares with machine learning, tracks prices and lets you mock-book a
ticket. It works in **11 languages** (including right-to-left Arabic) and supports **voice search
and read-aloud**.

> **Demo project.** Everything runs on realistic *simulated* data: airlines, flights, fares and
> bookings are fictional. No real airline APIs, no real payments, no database.

## 🌐 Live demo

| | |
| --- | --- |
| **Live site** | _coming soon (Vercel)_ |
| **Repository** | _coming soon (GitHub)_ |

Try: search **Chennai → Delhi**, open **Budget mode**, run **Price prediction**, add a route to the
**Watchlist**, then book a flight with the test card `4111 1111 1111 1111` (any future expiry, any CVV).

---

## Features

| # | Feature | What you can do |
| --- | --- | --- |
| 1 | **Flight search** | From / to (28 airports, type city, code or local name), date, passengers (1-9), economy / business. Results show airline, departure / arrival, duration, stops (with layovers) and price. **Filters:** max price, stops, airline, departure time. **Sorting:** cheapest, fastest, best value, earliest. |
| 2 | **Budget mode** | Highlighted cheapest option, **fare calendar** (lowest fare per day, colour-coded, festival markers, "cheapest days this month"), **cheaper nearby dates** (±3 days), **nearby airports** (within ~320 km, either end), and a **maximum budget** that hides everything above it. |
| 3 | **ML price prediction** | A gradient-boosting model forecasts the fare for the next 30 booking days (with a likely range), plus a clear **"Book now"** or **"Wait – price likely to drop"** recommendation with a **confidence level** and reasons. A second chart shows the cheapest travel dates. Model accuracy (MAE, RMSE, MAPE, R²) is on the About page. |
| 4 | **Price tracker** | Watchlist of routes with a **target price**, 30-day **price history charts**, and an **in-app alert** when the simulated daily price check drops below the target. |
| 5 | **Mock booking** | Passenger details (validated) → **seat map** (window/aisle, extra legroom, paid seats) → add-ons (**meal, extra baggage**, priority, insurance) → **dummy payment** (Luhn-checked test card or UPI) → confirmation with **booking reference** and a downloadable **e-ticket PDF**. |
| 6 | **My trips** | Booked trips (confirmed / completed / cancelled, upcoming & past) and tracked flights (watching / price below target / departed). |
| 7 | **Dashboard** | Cheapest domestic routes this month, **trending destinations** (with photos), average fare trends (domestic vs international), fare by booking lead time & weekday, and **best-time-to-book tips** computed from the data. |
| 8 | **Multi-language** | English, தமிழ் Tamil, हिन्दी Hindi, తెలుగు Telugu, ಕನ್ನಡ Kannada, മലയാളം Malayalam, বাংলা Bengali, मराठी Marathi, Español, Français and العربية Arabic (**RTL layout**). Switcher in the nav bar, choice remembered in `localStorage`, numbers/dates/currency localised with `Intl`, city names localised. |
| 9 | **Voice** | **Voice search** in the selected language ("flights from Chennai to Delhi next Friday", "சென்னையிலிருந்து டெல்லிக்கு நாளை", "दिल्ली से मुंबई कल 2 यात्री") using the browser's speech recognition, and **read-aloud** of results, budget tips and price recommendations with speech synthesis. Unsupported browser, blocked mic, unsupported language or missing voice → a friendly message and typing works as usual. |

Also: light / dark mode, fully responsive (mobile → desktop), loading states with an animated
plane, illustrated empty states, a 404 page, and an animated plane on the "Book now" recommendation.

## Tech stack

- **Next.js 16 (App Router)** + **React 19** + **TypeScript**
- **Tailwind CSS 4**, **Recharts 3** (charts), **lucide-react** (icons), **jsPDF** (e-ticket)
- **Next.js Route Handlers** (`src/app/api/*`) as the backend — the whole app deploys to **Vercel** as one project
- **Python 3 + scikit-learn + NumPy** for training (offline only)
- `next/image` for optimised photos, `next/font` for self-hosted Inter + Noto fonts (Tamil, Devanagari, Telugu, Kannada, Malayalam, Bengali, Arabic)
- Browser **localStorage** for watchlist, bookings, alerts, theme and language — no database

## How the ML prediction works

```
scripts/generate-data.ts  ──►  ml/data/fare_history.csv  ──►  ml/train_model.py  ──►  src/data/ml/fare-model.json  ──►  /api/predict (TypeScript)
   simulate 12 months           275,888 fare records          scikit-learn GBM         320 exported trees (~680 KB)      no Python on Vercel
```

1. **Sample data.** `src/lib/sim/` is a deterministic fare simulator: 28 airports (17 Indian, 11
   international), 8 fictional airlines, ~6,500 scheduled services. A fare is
   *base fare (distance) × airline × booking lead time × weekday × time of day × season × holiday
   demand × stops × cabin × market noise*. It produces realistic patterns:
   - **weekend & holiday spikes** – Friday/Sunday cost more; Diwali, Holi, Eid, Onam, Pongal, Durga Puja, Christmas… (2025-27 dates) push fares up, regional festivals only for their cities;
   - **prices rise as departure gets closer** – cheapest ~3-8 weeks out, up to ~1.6-1.9× in the last days;
   - **cheaper early-morning and late-night flights**, pricier business-hour banks;
   - **seasonal demand** – Dec/Jan and May/Jun peaks, monsoon low season, beach destinations peak in winter, Gulf routes in summer.
2. **Dataset.** `npm run data` writes one observed fare per route (756 routes), departure day
   (365 days) and time-of-day bucket, quoted 0-120 days ahead → **275,888 rows**.
3. **Features** (`src/lib/ml/features.ts`, shared by the generator *and* the API so they never drift):
   route (origin, destination, distance, domestic/long-haul, regions, destination type, popularity),
   **days before departure**, **day of week**, **month**, **holiday** (flag, importance, days to holiday)
   and **time of day**.
4. **Training** (`ml/train_model.py`): random 80/20 hold-out split; a route-average baseline, a
   `RandomForestRegressor` (comparison) and a `GradientBoostingRegressor` (served), trained on log(price).
5. **Results on the 55,177-row test set:**

   | Model | MAE | MAPE | R² |
   | --- | --- | --- | --- |
   | Route average (baseline) | ₹4,646 | 24.2% | 0.851 |
   | Random forest | ₹1,830 | 9.9% | 0.978 |
   | **Gradient boosting (used)** | **₹1,384** | **7.7%** | **0.989** |

   Domestic MAE ₹431, international MAE ₹1,916. Shown live on the **About** page with feature
   importance and a predicted-vs-actual chart.
6. **Export & serving.** The trained trees are exported to `src/data/ml/fare-model.json`;
   `src/lib/ml/model.ts` walks them in TypeScript (a unit test checks parity with scikit-learn's own
   predictions). `/api/predict` predicts the fare for each of the next 30 booking days, calibrates the
   curve to today's observed lowest fare, and recommends **Wait** if a drop of ≥3% (and ≥₹150) is expected,
   otherwise **Book now**. Confidence = probability the expected move exceeds the model's error
   (from the test-set residuals), shown as High / Medium / Low.

## Getting started

Requirements: **Node.js 20.9+** (22.18+ recommended so `.ts` scripts run natively) and, only for retraining, **Python 3.10+**.

```bash
npm install
npm run dev            # http://localhost:3000
```

The trained model and insights are committed, so the app works immediately. To regenerate the data
and retrain:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
npm run ml             # = npm run data && npm run train   (~2 minutes)
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (model parity with scikit-learn, multilingual voice parser) |
| `npm run check:i18n` | Reports missing translation keys / placeholder mismatches for every language |
| `npm run e2e` | Headless-Chrome smoke test of every page, viewport, language and flow (`BASE_URL=http://localhost:3000 npm run e2e`) |

## Adding a language

1. Copy `src/i18n/messages/fr.ts` to `src/i18n/messages/<code>.ts` and translate the values (keys are typed against English).
2. Add one entry to `LOCALES` in `src/i18n/config.ts` (native name, `dir`, Intl + speech tags) and a loader line in `src/i18n/index.tsx`.
3. Optionally add localised city names in `src/i18n/cities.ts` (also used by voice search) and voice words in `src/lib/voice/parse.ts`.
4. Run `npm run check:i18n`. Missing keys fall back to English at runtime.

## Project structure

```
src/
  app/                 pages (/, results, budget, predict, watchlist, trips, dashboard, about, book) + api/ route handlers
  components/          UI (search form, flight list, fare calendar, seat map, charts, voice, illustrations)
  i18n/                language registry, provider, 11 message files, localised city names
  lib/sim/             deterministic airports / airlines / holidays / schedules / fare model
  lib/ml/              feature builder, tree-walker inference, prediction + recommendation
  lib/voice/           speech recognition / synthesis hooks, multilingual query parser
  lib/                 booking rules, services, localStorage stores, PDF ticket
  data/                exported model, metrics, insights, image credits
ml/                    train_model.py, requirements.txt, data/ (sample CSV committed, full CSV git-ignored)
scripts/               generate-data.ts, check-i18n.ts, images/ (photo download + optimisation)
tests/                 unit/ (node:test) and e2e/ (headless Chrome via DevTools protocol)
public/images/         optimised hero + destination photos
```

## Notes & limitations

- **Voice recognition** works in Chrome, Edge and Safari (it is not available in Firefox). Chrome sends audio to Google's speech service. Indic-language recognition quality depends on the browser; if a language isn't accepted, SkyFare retries in English and tells you.
- **Read-aloud** depends on the voices installed on your device. Many desktops lack Tamil/Telugu/Kannada/Malayalam/Bengali/Marathi voices — SkyFare then shows a message instead of reading gibberish (Android and iOS usually have them).
- The **e-ticket PDF** is always in English (like real airline tickets); the PDF's built-in fonts can't render Indic/Arabic scripts.
- "Today" is computed in India time (IST). Fares change daily because the simulated booking date moves forward.
- Data lives in your browser — clearing site data removes your watchlist and bookings.

## Credits

**Airlines:** Saffron Air, Monsoon Jet, Lotus Wings, Coral Air, Peacock Airways, Desert Falcon, Orchid Pacific and
Northstar Atlantic are **fictional**; their logos are simple generated SVG marks. Airport names and codes are real and
used for realism only. Illustrations (planes, empty states, destination fallbacks) are original SVGs.

**Photos** (free licences; resized/cropped to 3:2, stored in `public/images`):

| Where | Photo | Author | Licence | Source |
| --- | --- | --- | --- | --- |
| Home hero | [Aerial photography of airliner wing above clouds](https://unsplash.com/photos/rf6ywHVkrlY) | Ross Parmly | [Unsplash License](https://unsplash.com/license) | Unsplash |
| Delhi | [India Gate - Delhi](https://commons.wikimedia.org/w/index.php?curid=28140657) | Gughanbose | CC BY-SA 3.0 | Wikimedia Commons |
| Mumbai | [Gateway of India - Mumbai](https://commons.wikimedia.org/w/index.php?curid=72913311) | Jawahar Soneji | CC BY-SA 4.0 | Wikimedia Commons |
| Bengaluru | [Vidhana Soudha Bangalore](https://commons.wikimedia.org/w/index.php?curid=84731216) | Wise Droid | CC BY-SA 4.0 | Wikimedia Commons |
| Chennai | [Sunrise at Chennai Marina beach](https://commons.wikimedia.org/w/index.php?curid=48631939) | Irfanahmed605 | CC BY-SA 4.0 | Wikimedia Commons |
| Hyderabad | [Clear view of Charminar Hyderabad](https://commons.wikimedia.org/w/index.php?curid=81916182) | Rashid Jorvee | CC BY-SA 4.0 | Wikimedia Commons |
| Kolkata | [Hooghly River and the Howrah Bridge](https://commons.wikimedia.org/w/index.php?curid=101410844) | Vyacheslav Argenberg | CC BY 4.0 | Wikimedia Commons |
| Kochi | [Kochi, Fishing nets at sunset](https://commons.wikimedia.org/w/index.php?curid=123025415) | Vyacheslav Argenberg | CC BY 4.0 | Wikimedia Commons |
| Goa | [Sunset at Goa beach](https://commons.wikimedia.org/w/index.php?curid=94977707) | Swapnilshirali | CC BY-SA 4.0 | Wikimedia Commons |
| Jaipur | [East facade Hawa Mahal Jaipur](https://commons.wikimedia.org/w/index.php?curid=120750436) | Chainwit. | CC BY-SA 4.0 | Wikimedia Commons |
| Dubai | [Dubai skyline](https://commons.wikimedia.org/w/index.php?curid=82583102) | Robert Bock | CC0 1.0 | Wikimedia Commons |
| Doha | [Doha skyline in the morning](https://commons.wikimedia.org/w/index.php?curid=32181989) | Francisco Anzola | CC BY 2.0 | Wikimedia Commons |
| Singapore | [Marina Bay Singapore](https://commons.wikimedia.org/w/index.php?curid=143514327) | Bijay Chaurasia | CC BY-SA 4.0 | Wikimedia Commons |
| Kuala Lumpur | [The Petronas Towers in 2024](https://commons.wikimedia.org/w/index.php?curid=150061987) | Admiralhirohito | CC0 1.0 | Wikimedia Commons |
| Bangkok | [Templo Wat Arun, Bangkok](https://commons.wikimedia.org/w/index.php?curid=28363649) | Diego Delso | CC BY-SA 3.0 | Wikimedia Commons |
| London | [Tower Bridge seen from the south bank](https://commons.wikimedia.org/w/index.php?curid=83158043) | Tristan Surtel | CC BY-SA 4.0 | Wikimedia Commons |
| Paris | [Eiffel Tower & Champ de Mars](https://commons.wikimedia.org/w/index.php?curid=83084137) | Steven Penton | CC BY 2.0 | Wikimedia Commons |
| New York | [Lower Manhattan skyline - June 2017](https://commons.wikimedia.org/w/index.php?curid=60794455) | MusikAnimal | CC BY-SA 4.0 | Wikimedia Commons |

Cities without a photo use an illustrated SVG card. Credits are also shown on each photo and on the
About page (`src/data/image-credits.json`). Festival dates: timeanddate.com / Government of India holiday lists.

## License

Code: MIT. Photos: their respective licences above (CC BY / CC BY-SA photos require attribution and
share-alike for adaptations).
