import { toUserMessage } from "./errors";
import { setLanguage } from "@/i18n";

beforeEach(() => setLanguage("fr", { persist: false }));

describe("toUserMessage", () => {
  it("traduit les codes levés par les fonctions SQL", () => {
    expect(toUserMessage({ message: "slot_unavailable", code: "P0001" })).toMatch(/plus disponible/);
  });

  it("traduit les codes d’erreur Supabase Auth", () => {
    expect(toUserMessage({ code: "otp_expired", message: "Token has expired or is invalid" })).toMatch(/expiré/);
  });

  it("ne divulgue jamais un message technique inconnu", () => {
    expect(toUserMessage(new Error('relation "x" does not exist'))).toMatch(/Une erreur est survenue/);
    expect(toUserMessage(null)).toMatch(/Une erreur est survenue/);
  });
});
