import type { Widen } from "@/i18n/fr";

// Textes « mfa » : le français fait référence, l’anglais doit avoir exactement les mêmes clés.
export const fr = {
  challengeTitle: "Double authentification",
  challengeText: "Saisissez le code à 6 chiffres affiché par votre application d’authentification.",
  code: "Code à 6 chiffres",
  verify: "Valider",
  codeInvalid: "Code incorrect ou expiré. Saisissez le code affiché en ce moment.",
};

export const en: Widen<typeof fr> = {
  challengeTitle: "Two-factor authentication",
  challengeText: "Enter the 6-digit code shown in your authenticator app.",
  code: "6-digit code",
  verify: "Verify",
  codeInvalid: "Incorrect or expired code. Enter the code shown right now.",
};
