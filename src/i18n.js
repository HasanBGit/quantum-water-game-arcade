// Which language the game speaks. English is the base; Arabic fills in what it has translated and
// anything missing falls back to English, so a new English string never leaves a hole.
import { STRINGS } from "./strings.js";
import { AR } from "./strings.ar.js";

export const LANGUAGES = { en: "English", ar: "العربية" };

function merge(base, over) {
  if (Array.isArray(over)) return over;
  if (over && typeof over === "object" && base && typeof base === "object" && !Array.isArray(base)) {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
    return out;
  }
  return over === undefined ? base : over;
}

/** "?lang=ar" wins, then the saved choice, then English. */
export function pickLang(search = "", saved = "") {
  const q = new URLSearchParams(search).get("lang");
  if (q === "ar" || q === "en") return q;
  return saved === "ar" ? "ar" : "en";
}

/** The `game` text block for a language. */
export function gameStrings(lang) {
  return lang === "ar" ? merge(STRINGS.en.game, AR.game) : STRINGS.en.game;
}
