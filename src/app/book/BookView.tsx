"use client";
// Mock booking flow: passengers -> seats -> add-ons -> dummy payment ->
// confirmation with booking reference and downloadable PDF e-ticket.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, CreditCard, Download, Luggage, ShieldCheck, Smartphone, Ticket, UtensilsCrossed, Zap } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { luhn, priceSummary, validateEmail, validatePassenger, validatePhone, validExpiry, validUpi, type PassengerInput } from "@/lib/booking";
import { api, ApiError, useApi } from "@/lib/client";
import { saveBooking, type Booking } from "@/lib/storage";
import { downloadTicket } from "@/lib/ticket";
import type { FlightDetailResponse } from "@/lib/types";
import { AirlineLogo } from "@/components/AirlineLogo";
import { PlaneIcon } from "@/components/illustrations";
import { SeatMap } from "@/components/SeatMap";
import { Button, ButtonLink, Card, EmptyState, Field, Loading, Notice, inputClass } from "@/components/ui";

const STEPS: MessageKey[] = ["book.step.passengers", "book.step.seats", "book.step.addons", "book.step.payment", "book.step.confirm"];

type Pax = PassengerInput & { seat?: string; meal?: boolean; bag?: "none" | "bag5" | "bag10" };

const blankPax = (): Pax => ({ title: "Mr", firstName: "", lastName: "", age: NaN, gender: "", meal: false, bag: "none" });

/** Keep the title in step with gender unless the user chose Mrs / Dr deliberately. */
function titleFor(current: string, gender: string) {
  if (!["Mr", "Ms", "Mx"].includes(current)) return current;
  return gender === "male" ? "Mr" : gender === "female" ? "Ms" : "Mx";
}

export function BookView() {
  const sp = useSearchParams();
  const flightId = sp.get("flight") ?? "";
  const paxCount = Math.min(9, Math.max(1, Number(sp.get("pax") ?? 1)));
  const { t, formatPrice, formatDate, formatDuration, city } = useI18n();
  const { data, loading, error } = useApi<FlightDetailResponse>(flightId ? `/api/flight?id=${encodeURIComponent(flightId)}` : null);

  const [step, setStep] = useState(0);
  const [pax, setPax] = useState<Pax[]>(() => Array.from({ length: paxCount }, blankPax));
  const [contact, setContact] = useState({ email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activePax, setActivePax] = useState(0);
  const [extras, setExtras] = useState({ priority: false, insurance: false });
  const [method, setMethod] = useState<"card" | "upi">("card");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [upi, setUpi] = useState("");
  const [paying, setPaying] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // All hooks run before any early return (rules of hooks).
  const flight = data?.flight;
  const seatPrices = useMemo(() => Object.fromEntries((data?.seatMap.rows ?? []).flatMap((r) => r.seats).map((s) => [s.id, s.price])), [data]);
  const summary = flight ? priceSummary(flight.price, pax, flight.from, flight.to, flight.cabin, extras, seatPrices) : null;
  const assigned = Object.fromEntries(pax.map((p, i) => [p.seat, i]).filter(([s]) => s)) as Record<string, number>;

  if (!flightId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <EmptyState title={t("book.missing.title")} body={t("book.missing.body")} action={<ButtonLink href="/">{t("search.submit")}</ButtonLink>} />
        </Card>
      </div>
    );
  }
  if (loading) return <Loading label={t("common.loading")} />;
  if (error || !data || !flight || !summary) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <EmptyState title={t("book.error.flightGone")} action={<ButtonLink href="/">{t("search.submit")}</ButtonLink>} />
        </Card>
      </div>
    );
  }

  const validatePaxStep = () => {
    const e: Record<string, string> = {};
    pax.forEach((p, i) => {
      for (const f of validatePassenger(p)) e[`p${i}.${f}`] = t(`book.error.${f}` as MessageKey);
    });
    if (!validateEmail(contact.email)) e.email = t("book.error.email");
    if (!validatePhone(contact.phone)) e.phone = t("book.error.phone");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickSeat = (id: string) => {
    setPax((list) => {
      const next = list.map((p) => ({ ...p }));
      const owner = next.findIndex((p) => p.seat === id);
      if (owner >= 0) {
        next[owner].seat = undefined;
        if (owner === activePax) return next;
      }
      next[activePax].seat = id;
      return next;
    });
    if (activePax < pax.length - 1) setActivePax(activePax + 1);
  };

  const autoAssign = () => {
    const free = data.seatMap.rows.flatMap((r) => r.seats).filter((s) => !s.taken && s.price === 0 && !assigned[s.id]);
    setPax((list) => list.map((p, i) => (p.seat ? p : { ...p, seat: free[i]?.id })));
  };

  const fillTest = () => {
    setMethod("card");
    setCard({ number: "4111 1111 1111 1111", name: `${pax[0].firstName || "Demo"} ${pax[0].lastName || "User"}`.trim(), expiry: "12/30", cvv: "123" });
  };

  const validatePayment = () => {
    const e: Record<string, string> = {};
    if (method === "card") {
      if (!luhn(card.number) || !validExpiry(card.expiry) || !/^\d{3,4}$/.test(card.cvv) || !card.name.trim()) e.card = t("book.error.card");
    } else if (!validUpi(upi)) e.upi = t("book.error.upi");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pay = async () => {
    if (!validatePayment()) return;
    setPaying(true);
    setServerError(null);
    try {
      // Simulated processing delay so the flow feels real.
      await new Promise((r) => setTimeout(r, 1200));
      const res = await api<{ booking: Booking }>("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightId: flight.id,
          passengers: pax.map((p) => ({ ...p, age: Number(p.age) })),
          contact,
          extras,
          payment: method === "card" ? { method, last4: card.number.replace(/\D/g, "").slice(-4), cardValid: true } : { method, upiId: upi.trim() },
        }),
      });
      saveBooking(res.booking);
      setBooking(res.booking);
      setStep(4);
    } catch (e) {
      const err = e as ApiError;
      setServerError(err.code === "flightNotFound" ? t("book.error.flightGone") : err.code === "offline" ? t("common.offline") : t("book.error.generic"));
    } finally {
      setPaying(false);
    }
  };

  const next = () => {
    if (step === 0 && !validatePaxStep()) return;
    if (step === 1 && pax.some((p) => !p.seat)) {
      setErrors({ seats: t("book.error.seats") });
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  };

  const addonPrice = data.addons;
  const business = flight.cabin === "business";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">{t("book.title")}</h1>
      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-1 overflow-x-auto pb-1" data-testid="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                i < step ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : i === step ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span>{i + 1}</span>}
              {t(s)}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-slate-300 dark:bg-slate-700" />}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {step === 0 && (
            <>
              {pax.map((p, i) => (
                <Card key={i} className="p-4" as="section">
                  <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("book.passenger", { n: i + 1 })}</h2>
                  <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr]">
                    <Field label={t("book.title.label")} htmlFor={`p${i}-title`}>
                      <select id={`p${i}-title`} value={p.title} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={inputClass}>
                        {["Mr", "Ms", "Mrs", "Mx", "Dr"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("book.firstName")} htmlFor={`p${i}-first`} error={errors[`p${i}.firstName`]}>
                      <input id={`p${i}-first`} data-testid={`p${i}-first`} autoComplete="given-name" value={p.firstName} aria-invalid={Boolean(errors[`p${i}.firstName`]) || undefined} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, firstName: e.target.value } : x)))} className={inputClass} />
                    </Field>
                    <Field label={t("book.lastName")} htmlFor={`p${i}-last`} error={errors[`p${i}.lastName`]}>
                      <input id={`p${i}-last`} data-testid={`p${i}-last`} autoComplete="family-name" value={p.lastName} aria-invalid={Boolean(errors[`p${i}.lastName`]) || undefined} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, lastName: e.target.value } : x)))} className={inputClass} />
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={t("book.age")} htmlFor={`p${i}-age`} error={errors[`p${i}.age`]}>
                      <input id={`p${i}-age`} data-testid={`p${i}-age`} type="number" min={0} max={110} inputMode="numeric" value={Number.isNaN(p.age) ? "" : p.age} aria-invalid={Boolean(errors[`p${i}.age`]) || undefined} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, age: e.target.value === "" ? NaN : Number(e.target.value) } : x)))} className={inputClass} />
                    </Field>
                    <Field label={t("book.gender")} error={errors[`p${i}.gender`]}>
                      <div className="flex gap-2" role="radiogroup" aria-label={t("book.gender")}>
                        {(["male", "female", "other"] as const).map((g) => (
                          <label key={g} className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 py-2.5 text-sm font-medium ${p.gender === g ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100" : "border-slate-300 dark:border-slate-700"}`}>
                            <input type="radio" name={`p${i}-gender`} value={g} checked={p.gender === g} onChange={() => setPax(pax.map((x, j) => (j === i ? { ...x, gender: g, title: titleFor(x.title, g) } : x)))} className="sr-only" data-testid={`p${i}-gender-${g}`} />
                            {t(`book.gender.${g}`)}
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>
                </Card>
              ))}
              <Card className="p-4" as="section">
                <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">{t("book.contact")}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("book.email")} htmlFor="email" error={errors.email}>
                    <input id="email" data-testid="email" type="email" autoComplete="email" value={contact.email} aria-invalid={Boolean(errors.email) || undefined} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label={t("book.phone")} htmlFor="phone" error={errors.phone}>
                    <input id="phone" data-testid="phone" type="tel" autoComplete="tel" value={contact.phone} aria-invalid={Boolean(errors.phone) || undefined} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+91 98765 43210" className={inputClass} />
                  </Field>
                </div>
              </Card>
            </>
          )}

          {step === 1 && (
            <Card className="p-4" as="section">
              <div className="mb-3 flex flex-wrap gap-2">
                {pax.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActivePax(i)}
                    className={`rounded-xl border px-3 py-2 text-start text-sm ${i === activePax ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-slate-200 dark:border-slate-700"}`}
                  >
                    <span className="block font-semibold text-slate-900 dark:text-white">
                      {i + 1}. {p.firstName || t("book.passenger", { n: i + 1 })}
                    </span>
                    <span className="text-xs text-slate-500">{p.seat ? `${p.seat}${seatPrices[p.seat] ? ` · ${formatPrice(seatPrices[p.seat])}` : ` · ${t("book.seat.free")}`}` : "-"}</span>
                  </button>
                ))}
                <Button variant="ghost" size="sm" onClick={autoAssign} className="ms-auto" data-testid="auto-assign">
                  {t("book.seat.autoAssign")}
                </Button>
              </div>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t("book.seat.choose", { name: pax[activePax].firstName || t("book.passenger", { n: activePax + 1 }) })}</p>
              <SeatMap map={data.seatMap} assigned={assigned} activeIndex={activePax} onPick={pickSeat} />
              {errors.seats && <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{errors.seats}</p>}
            </Card>
          )}

          {step === 2 && (
            <>
              {pax.map((p, i) => (
                <Card key={i} className="p-4" as="section">
                  <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
                    {p.title} {p.firstName} {p.lastName} · {p.seat}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <UtensilsCrossed className="h-4 w-4 text-brand-600" aria-hidden="true" />
                        {t("book.addons.meal")}
                      </p>
                      {business ? (
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("book.addons.mealIncluded")}</p>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700">
                          <input type="checkbox" checked={Boolean(p.meal)} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, meal: e.target.checked } : x)))} className="h-4 w-4 accent-brand-600" data-testid={`p${i}-meal`} />
                          <span className="flex-1">{t("book.addons.meal")}</span>
                          <span className="tabular font-semibold">{formatPrice(addonPrice.meal)}</span>
                        </label>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <Luggage className="h-4 w-4 text-brand-600" aria-hidden="true" />
                        {t("book.addons.baggage")}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {(["none", "bag5", "bag10"] as const).map((b) => (
                          <label key={b} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${p.bag === b ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-slate-200 dark:border-slate-700"}`}>
                            <input type="radio" name={`p${i}-bag`} checked={p.bag === b} onChange={() => setPax(pax.map((x, j) => (j === i ? { ...x, bag: b } : x)))} className="h-4 w-4 accent-brand-600" data-testid={`p${i}-${b}`} />
                            <span className="flex-1">{b === "none" ? t("book.addons.bagNone") : t(`book.addons.${b}`)}</span>
                            {b !== "none" && <span className="tabular font-semibold">{formatPrice(addonPrice[b])}</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              <Card className="p-4" as="section">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["priority", "insurance"] as const).map((x) => (
                    <label key={x} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700">
                      <input type="checkbox" checked={extras[x]} onChange={(e) => setExtras({ ...extras, [x]: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                      {x === "priority" ? <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
                      <span className="flex-1">{t(`book.addons.${x}`)}</span>
                      <span className="tabular text-xs font-semibold">
                        {formatPrice(addonPrice[x])} {t("book.addons.perPax")}
                      </span>
                    </label>
                  ))}
                </div>
              </Card>
            </>
          )}

          {step === 3 && (
            <Card className="p-4" as="section">
              <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">{t("book.payment.title")}</h2>
              <Notice tone="warn">{t("book.payment.notice")}</Notice>
              <div className="mt-4 inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-700" role="tablist">
                {(["card", "upi"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => setMethod(m)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold ${method === m ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300"}`} data-testid={`pay-${m}`}>
                    {m === "card" ? <CreditCard className="h-4 w-4" aria-hidden="true" /> : <Smartphone className="h-4 w-4" aria-hidden="true" />}
                    {t(`book.payment.${m}`)}
                  </button>
                ))}
              </div>
              {method === "card" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label={t("book.payment.cardNumber")} htmlFor="cc">
                      <input id="cc" data-testid="card-number" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, "").slice(0, 23) })} placeholder="4111 1111 1111 1111" className={inputClass} />
                    </Field>
                  </div>
                  <Field label={t("book.payment.cardName")} htmlFor="ccname">
                    <input id="ccname" autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} className={inputClass} data-testid="card-name" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("book.payment.expiry")} htmlFor="ccexp">
                      <input id="ccexp" inputMode="numeric" autoComplete="cc-exp" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value.slice(0, 5) })} placeholder="12/30" className={inputClass} data-testid="card-expiry" />
                    </Field>
                    <Field label={t("book.payment.cvv")} htmlFor="cccvv">
                      <input id="cccvv" inputMode="numeric" autoComplete="cc-csc" type="password" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="123" className={inputClass} data-testid="card-cvv" />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="mt-4 max-w-sm">
                  <Field label={t("book.payment.upiId")} htmlFor="upi" error={errors.upi}>
                    <input id="upi" data-testid="upi-id" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="demo@upi" className={inputClass} />
                  </Field>
                </div>
              )}
              {errors.card && <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{errors.card}</p>}
              {serverError && (
                <div className="mt-3">
                  <Notice tone="error">{serverError}</Notice>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={fillTest} data-testid="fill-test">
                  {t("book.payment.fillTest")}
                </Button>
              </div>
            </Card>
          )}

          {step === 4 && booking && (
            <Card className="overflow-hidden" as="section">
              <div className="bg-gradient-to-br from-emerald-50 to-white p-6 text-center dark:from-emerald-950/60 dark:to-slate-900" data-testid="confirmation">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden="true" />
                <h2 className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">{t("book.confirmed.title")}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("book.confirmed.body")}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("book.confirmed.ref")}</p>
                <p className="font-mono text-3xl font-black tracking-[0.3em] text-brand-700 dark:text-brand-300" data-testid="booking-ref">
                  {booking.ref}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => downloadTicket(booking)} data-testid="download-ticket">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t("book.confirmed.download")}
                  </Button>
                  <ButtonLink href="/trips" variant="secondary">
                    <Ticket className="h-4 w-4" aria-hidden="true" />
                    {t("book.confirmed.trips")}
                  </ButtonLink>
                  <ButtonLink href="/" variant="ghost">
                    {t("book.confirmed.another")}
                  </ButtonLink>
                </div>
              </div>
            </Card>
          )}

          {step < 4 && (
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => (step === 0 ? history.back() : setStep(step - 1))} disabled={paying}>
                {t("book.back")}
              </Button>
              {step < 3 ? (
                <Button onClick={next} data-testid="book-next">
                  {t("book.next")}
                </Button>
              ) : (
                <Button variant="success" size="lg" onClick={pay} disabled={paying} data-testid="pay-button">
                  {paying ? (
                    <>
                      <PlaneIcon className="rtl-flip h-4 w-8 animate-takeoff" />
                      {t("book.payment.processing")}
                    </>
                  ) : (
                    t("book.payment.pay", { amount: formatPrice(summary.total) })
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: flight + fare summary */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <AirlineLogo code={flight.airline} size={36} />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{flight.airlineName}</p>
                <p className="text-xs text-slate-500">{flight.flightNo} · {flight.cabin === "business" ? t("search.business") : t("search.economy")}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <div>
                <p className="tabular text-lg font-bold">{flight.depTime}</p>
                <p className="text-xs text-slate-500">{city(flight.from)}</p>
              </div>
              <div className="text-center text-xs text-slate-500">
                <PlaneIcon className="rtl-flip mx-auto h-3 w-6 text-brand-500" />
                {formatDuration(flight.durationMin)}
              </div>
              <div className="text-end">
                <p className="tabular text-lg font-bold">
                  {flight.arrTime}
                  {flight.arrDayOffset > 0 && <sup className="text-[10px] text-rose-500">+{flight.arrDayOffset}</sup>}
                </p>
                <p className="text-xs text-slate-500">{city(flight.to)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">{formatDate(flight.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">{t("book.summary")}</h2>
            <dl className="space-y-1.5 text-sm" data-testid="fare-summary">
              {(
                [
                  [t("book.summary.base", { count: pax.length, price: formatPrice(flight.price) }), summary.baseFare],
                  [t("book.summary.taxes"), summary.taxes],
                  [t("book.summary.fee"), summary.convenienceFee],
                  [t("book.summary.seats"), summary.seats],
                  [t("book.summary.meals"), summary.meals],
                  [t("book.summary.baggage"), summary.baggage],
                  [t("book.summary.extras"), summary.extras],
                ] as Array<[string, number]>
              )
                .filter(([, v], i) => i < 3 || v > 0)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-slate-600 dark:text-slate-400">{k}</dt>
                    <dd className="tabular font-medium">{formatPrice(v)}</dd>
                  </div>
                ))}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold dark:border-slate-700">
                <dt>{t("book.summary.total")}</dt>
                <dd className="tabular text-brand-700 dark:text-brand-300" data-testid="fare-total">
                  {formatPrice(summary.total)}
                </dd>
              </div>
            </dl>
          </Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("app.demo")}{" "}
            <Link href="/about" className="underline">
              {t("nav.about")}
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
