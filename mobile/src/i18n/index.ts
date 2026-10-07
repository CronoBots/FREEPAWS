import { getLocales } from "expo-localization";
import { useSyncExternalStore } from "react";

import { en } from "@/i18n/en";
import { type Dictionary, fr } from "@/i18n/fr";
import { sessionStorage as storage } from "@/lib/session-storage";

// Français et anglais au lancement ; ajouter « nl » ou « de » = un dictionnaire + une entrée ici.
const DICTIONARIES = { fr, en } satisfies Record<string, Dictionary>;
export type Language = keyof typeof DICTIONARIES;
export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];
const LOCALES: Record<Language, string> = { fr: "fr-BE", en: "en-GB" };
const STORAGE_KEY = "freepaws.language";

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TranslationKey = Paths<Dictionary>;
type PluralBase<K extends string> = K extends `${infer B}_one` ? B : never;
export type PluralKey = PluralBase<TranslationKey>;
type Vars = Record<string, string | number>;

function detect(): Language {
  const code = getLocales()[0]?.languageCode ?? "fr";
  return code in DICTIONARIES ? (code as Language) : code === "nl" || code === "de" ? "en" : "fr";
}

let current: Language = detect();
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

/** Locale Intl de la langue courante (formats de dates et de prix). */
export function getLocale(): string {
  return LOCALES[current];
}

export function setLanguage(language: Language, options: { persist?: boolean } = {}) {
  if (language === current) return;
  current = language;
  listeners.forEach((listener) => listener());
  if (options.persist !== false) void storage.setItem(STORAGE_KEY, language).catch(() => undefined);
}

/** Relit la langue choisie par l'utilisateur (à appeler au démarrage). */
export async function loadStoredLanguage() {
  try {
    const stored = await storage.getItem(STORAGE_KEY);
    if (stored && stored in DICTIONARIES) setLanguage(stored as Language, { persist: false });
  } catch {
    // Pas de préférence enregistrée : langue de l'appareil.
  }
}

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === "string" ? node : undefined;
}

function interpolate(text: string, vars?: Vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match)) : text;
}

export function t(key: TranslationKey, vars?: Vars): string {
  return interpolate(lookup(DICTIONARIES[current], key) ?? lookup(fr, key) ?? key, vars);
}

/** Pluriel : utilise les clés « <clé>_one » et « <clé>_other ». */
export function tp(key: PluralKey, count: number, vars?: Vars): string {
  const rule = new Intl.PluralRules(getLocale()).select(count);
  const suffix = rule === "one" ? "_one" : "_other";
  return t(`${key}${suffix}` as TranslationKey, { count, ...vars });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-rend le composant quand la langue change. */
export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return { language, setLanguage, t, tp };
}
