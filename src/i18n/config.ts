// Language registry. To add a language:
//   1. create src/i18n/messages/<code>.ts implementing `Messages`
//   2. add one entry below (and to MESSAGE_LOADERS in index.tsx)
//   3. run `npm run check:i18n` to see any missing keys
// `speech` is the BCP-47 tag used for speech recognition / synthesis,
// `numbering` controls digits in Intl number/date formatting.

export interface LocaleInfo {
  code: string;
  /** Name in the language itself, shown in the switcher. */
  native: string;
  /** English name, used in messages like "voice input for Tamil...". */
  english: string;
  dir: "ltr" | "rtl";
  /** BCP-47 tag for Intl formatting. */
  intl: string;
  /** BCP-47 tag for the Web Speech API. */
  speech: string;
}

export const LOCALES: LocaleInfo[] = [
  { code: "en", native: "English", english: "English", dir: "ltr", intl: "en-IN", speech: "en-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", dir: "ltr", intl: "ta-IN", speech: "ta-IN" },
  { code: "hi", native: "हिन्दी", english: "Hindi", dir: "ltr", intl: "hi-IN", speech: "hi-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", dir: "ltr", intl: "te-IN", speech: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", dir: "ltr", intl: "kn-IN", speech: "kn-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", dir: "ltr", intl: "ml-IN", speech: "ml-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", dir: "ltr", intl: "bn-IN", speech: "bn-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", dir: "ltr", intl: "mr-IN", speech: "mr-IN" },
  { code: "es", native: "Español", english: "Spanish", dir: "ltr", intl: "es-ES", speech: "es-ES" },
  { code: "fr", native: "Français", english: "French", dir: "ltr", intl: "fr-FR", speech: "fr-FR" },
  { code: "ar", native: "العربية", english: "Arabic", dir: "rtl", intl: "ar-AE", speech: "ar-AE" },
];

export const DEFAULT_LOCALE = "en";
export const LOCALE_CODES = LOCALES.map((l) => l.code);
export const LOCALE_STORAGE_KEY = "skyfare.lang";

export function localeInfo(code: string): LocaleInfo {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
