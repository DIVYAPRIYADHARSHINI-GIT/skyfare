"use client";
// Microphone button: listens in the selected language, parses the sentence
// into a search and reports progress / friendly fallbacks to text input.
import { Mic, MicOff, Square } from "lucide-react";
import { useI18n } from "@/i18n";
import { parseVoiceQuery, type VoiceQuery } from "@/lib/voice/parse";
import { useSpeechRecognition } from "@/lib/voice/speech";
import { todayISO } from "@/lib/sim/dates";

export interface VoiceOutcome {
  query: VoiceQuery;
  transcript: string;
}

export function useVoiceSearch(onResult: (r: VoiceOutcome) => void) {
  const { info } = useI18n();
  const rec = useSpeechRecognition((text) => {
    onResult({ query: parseVoiceQuery(text, todayISO()), transcript: text });
  });
  return { ...rec, start: () => rec.start(info.speech) };
}

export function VoiceStatusMessage({ status, outcome }: { status: ReturnType<typeof useSpeechRecognition>["status"]; outcome: VoiceOutcome | null }) {
  const { t, info, city, formatDate } = useI18n();
  if (status.state === "idle") return null;
  if (status.state === "listening") {
    return (
      <p role="status" data-testid="voice-status" className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-200">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        {status.interim ? t("voice.heard", { text: status.interim }) : t("voice.listening")}
        {status.fallbackLang && <span className="text-amber-700 dark:text-amber-300"> · {t("voice.unsupportedLang", { language: info.native })}</span>}
      </p>
    );
  }
  if (status.state === "error") {
    const key =
      status.reason === "unsupported"
        ? "voice.unsupported"
        : status.reason === "denied"
          ? "voice.denied"
          : status.reason === "noSpeech"
            ? "voice.noSpeech"
            : status.reason === "insecure"
              ? "voice.insecure"
              : status.reason === "unsupportedLang"
                ? "voice.unsupportedLang"
                : "voice.error";
    return (
      <p role="alert" data-testid="voice-status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
        {t(key, { language: info.native })}
      </p>
    );
  }
  // done
  const q = outcome?.query ?? {};
  const parts = [q.from && city(q.from), q.to && city(q.to)].filter(Boolean).join(" → ");
  const summary = [parts, q.date && formatDate(q.date), q.pax && t("search.passengerCount", { count: q.pax })].filter(Boolean).join(" · ");
  const complete = Boolean(q.from && q.to);
  return (
    <p role="status" data-testid="voice-status" className="text-sm text-slate-700 dark:text-slate-200">
      {t("voice.heard", { text: status.transcript })}{" "}
      {summary ? (
        <strong className="text-brand-700 dark:text-brand-200">{complete ? t("voice.understood", { summary }) : t("voice.partial")}</strong>
      ) : (
        <span className="text-amber-700 dark:text-amber-300">{t("voice.notUnderstood", { text: status.transcript })}</span>
      )}
    </p>
  );
}

export function VoiceButton({ listening, onStart, onStop, supported }: { listening: boolean; onStart: () => void; onStop: () => void; supported: boolean | null }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={listening ? onStop : onStart}
      data-testid="voice-button"
      aria-pressed={listening}
      title={supported === false ? t("voice.unsupported") : listening ? t("voice.stop") : t("voice.start")}
      aria-label={listening ? t("voice.stop") : t("voice.start")}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
        listening
          ? "border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-500/30"
          : supported === false
            ? "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
            : "border-brand-200 bg-white text-brand-600 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-300"
      }`}
    >
      {listening ? <Square className="h-5 w-5" /> : supported === false ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
