import {
  addDays,
  brusselsDateTime,
  dayParts,
  formatDateTime,
  formatDayLong,
  formatDuration,
  formatTime,
  toIsoDay,
} from "./dates";
import { setLanguage } from "@/i18n";

beforeEach(() => setLanguage("fr", { persist: false }));

describe("dates (heure de Bruxelles)", () => {
  it("affiche l’heure locale de Bruxelles, été comme hiver", () => {
    expect(formatTime("2026-07-01T08:00:00Z")).toBe("10:00");
    expect(formatTime("2026-12-01T08:00:00Z")).toBe("09:00");
  });

  it("formate une date avec l’heure", () => {
    expect(formatDateTime("2026-10-07T18:27:00Z")).toBe("7 octobre 2026 à 20:27");
    setLanguage("en", { persist: false });
    expect(formatDateTime("2026-10-07T18:27:00Z")).toBe("7 October 2026 at 20:27");
  });

  it("calcule le jour calendaire à Bruxelles, pas en UTC", () => {
    expect(toIsoDay("2026-10-13T22:30:00Z")).toBe("2026-10-14");
  });

  it("formate un jour en toutes lettres avec majuscule", () => {
    expect(formatDayLong("2026-10-14T10:00:00Z")).toMatch(/^Mercredi 14 octobre$/);
  });

  it("ajoute des jours sans dépendre du fuseau ni des changements d’heure", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("découpe un jour pour le sélecteur", () => {
    expect(dayParts("2026-10-14")).toEqual({ weekday: "mer.", day: "14", month: "oct." });
  });

  it("formate les durées", () => {
    expect(formatDuration(45)).toBe("45\u00a0min");
    expect(formatDuration(60)).toBe("1\u00a0h");
    expect(formatDuration(90)).toBe("1\u00a0h\u00a030");
  });
});

describe("brusselsDateTime", () => {
  it("convertit une heure d’hiver et d’été de Bruxelles en UTC", () => {
    expect(brusselsDateTime("2026-12-01", "10:00")?.toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(brusselsDateTime("2026-07-01", "10:00")?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });

  it("gère les jours de changement d’heure", () => {
    expect(brusselsDateTime("2026-03-29", "01:30")?.toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(brusselsDateTime("2026-03-29", "03:30")?.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(brusselsDateTime("2026-10-25", "12:00")?.toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });

  it("refuse une heure inexistante ou une saisie invalide", () => {
    expect(brusselsDateTime("2026-03-29", "02:30")).toBeNull();
    expect(brusselsDateTime("2026-02-30", "10:00")).toBeNull();
    expect(brusselsDateTime("06/10/2026", "10:00")).toBeNull();
    expect(brusselsDateTime("2026-10-06", "25:00")).toBeNull();
  });
});
