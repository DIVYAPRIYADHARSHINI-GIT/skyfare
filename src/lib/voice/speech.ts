"use client";
// Browser speech helpers with graceful fallbacks.
// - Speech recognition (Chrome/Edge/Safari via webkitSpeechRecognition).
//   Firefox has no recognition API -> "unsupported" message, typing still works.
//   If the browser rejects the chosen language, we retry once in English.
// - Speech synthesis picks the best installed voice for the language and
//   reports when none exists (common for Indic languages on desktop).
import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceStatus =
  | { state: "idle" }
  | { state: "listening"; interim: string; fallbackLang?: boolean }
  | { state: "done"; transcript: string; fallbackLang?: boolean }
  | { state: "error"; reason: "unsupported" | "denied" | "noSpeech" | "insecure" | "error" | "unsupportedLang" };

/**
 * Speech-to-text. `start(lang)` listens once; the final transcript is passed to
 * `onFinal`. Unsupported browsers resolve immediately to an error state so the
 * UI can show a friendly "type instead" message.
 */
export function useSpeechRecognition(onFinal: (text: string, usedFallbackLang: boolean) => void) {
  const [status, setStatus] = useState<VoiceStatus>({ state: "idle" });
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const start = useCallback((lang: string) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus({ state: "error", reason: "unsupported" });
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setStatus({ state: "error", reason: "insecure" });
      return;
    }
    const run = (language: string, isFallback: boolean) => {
      let rec: SpeechRecognitionLike;
      try {
        rec = new Ctor();
      } catch {
        setStatus({ state: "error", reason: "unsupported" });
        return;
      }
      recRef.current = rec;
      rec.lang = language;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = "";
      let failed = false;
      rec.onstart = () => setStatus({ state: "listening", interim: "", fallbackLang: isFallback });
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        setStatus({ state: "listening", interim: finalText + interim, fallbackLang: isFallback });
      };
      rec.onerror = (e) => {
        failed = true;
        if (e.error === "language-not-supported" && !isFallback && !language.startsWith("en")) {
          // Retry once in English so the user still gets voice search.
          setTimeout(() => run("en-IN", true), 50);
          return;
        }
        const reason =
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "denied"
            : e.error === "no-speech" || e.error === "aborted"
              ? "noSpeech"
              : e.error === "language-not-supported"
                ? "unsupportedLang"
                : "error";
        setStatus({ state: "error", reason });
      };
      rec.onend = () => {
        if (failed) return;
        const text = finalText.trim();
        if (text) {
          setStatus({ state: "done", transcript: text, fallbackLang: isFallback });
          finalRef.current(text, isFallback);
        } else {
          setStatus({ state: "error", reason: "noSpeech" });
        }
      };
      try {
        rec.start();
      } catch {
        setStatus({ state: "error", reason: "error" });
      }
    };
    run(lang, false);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const reset = useCallback(() => setStatus({ state: "idle" }), []);

  return { status, start, stop, reset, supported };
}

export type TtsResult = "ok" | "unsupported" | "fallbackVoice" | "noVoice";

function pickVoice(voices: SpeechSynthesisVoice[], tag: string): { voice: SpeechSynthesisVoice | null; exact: boolean } {
  const lower = tag.toLowerCase();
  const base = lower.split("-")[0];
  const exact = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === lower);
  if (exact) return { voice: exact, exact: true };
  const sameLang = voices.find((v) => v.lang.toLowerCase().startsWith(base));
  if (sameLang) return { voice: sameLang, exact: true };
  return { voice: null, exact: false };
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const v = synth.getVoices();
    if (v.length) return resolve(v);
    const done = () => resolve(synth.getVoices());
    synth.addEventListener?.("voiceschanged", done, { once: true });
    setTimeout(done, 700);
  });
}

/** Text-to-speech with per-language voice selection. */
export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined");
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(async (text: string, langTag: string): Promise<TtsResult> => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      return "unsupported";
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = await loadVoices();
    const { voice } = pickVoice(voices, langTag);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langTag;
    u.rate = 1;
    let result: TtsResult = "ok";
    if (voice) u.voice = voice;
    else if (voices.length) {
      // No voice for this language: most engines will mangle the script.
      // Only speak if the text is Latin; otherwise report so the UI shows text.
      if (/[^\u0000-\u024f\s\d.,:;!?'"()%₹/-]/.test(text)) return "noVoice";
      result = "fallbackVoice";
    }
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
    return result;
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported };
}
