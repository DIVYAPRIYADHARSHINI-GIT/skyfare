"use client";
// "Read aloud" button using speech synthesis in the selected language, with
// friendly fallbacks when the browser or the language voice is missing.
import { useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSpeechSynthesis } from "@/lib/voice/speech";

export function ReadAloud({ text, className = "", size = "md" }: { text: string; className?: string; size?: "sm" | "md" }) {
  const { t, info } = useI18n();
  const { speak, stop, speaking } = useSpeechSynthesis();
  const [note, setNote] = useState<string | null>(null);

  const onClick = async () => {
    if (speaking) {
      stop();
      return;
    }
    const r = await speak(text, info.speech);
    if (r === "unsupported") setNote(t("voice.ttsUnsupported"));
    else if (r === "noVoice") setNote(t("voice.ttsNoVoiceAtAll", { language: info.native }));
    else if (r === "fallbackVoice") setNote(t("voice.ttsNoVoice", { language: info.native }));
    else setNote(null);
  };

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        data-testid="read-aloud"
        aria-pressed={speaking}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-200 dark:hover:bg-slate-800 ${size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
      >
        {speaking ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        {speaking ? t("voice.stopReading") : t("voice.readAloud")}
      </button>
      {note && (
        <span role="status" data-testid="tts-note" className="max-w-xs text-xs text-amber-700 dark:text-amber-300">
          {note}
        </span>
      )}
    </span>
  );
}
