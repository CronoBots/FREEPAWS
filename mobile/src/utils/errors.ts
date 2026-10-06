// Les fonctions SQL lèvent des codes stables (ex. « slot_unavailable ») ; on les traduit ici.
const MESSAGES: Record<string, string> = {
  slot_unavailable: "Ce créneau n'est plus disponible. Choisissez-en un autre.",
  appointment_full: "Il n'y a plus assez de places pour cette séance.",
  appointment_cancelled: "Cette séance a été annulée.",
  already_booked: "Vous êtes déjà inscrit·e à cette séance.",
  too_many_bookings: "Vous avez déjà 5 réservations à venir. Annulez-en une pour en ajouter une autre.",
  cancellation_too_late: "Le délai d'annulation est dépassé. Contactez-nous directement.",
  booking_in_past: "Cette réservation est déjà passée.",
  booking_not_found: "Réservation introuvable.",
  dog_not_found: "Ce chien n'est pas rattaché à votre compte.",
  service_not_found: "Cette prestation n'est plus proposée.",
  not_authenticated: "Connectez-vous pour continuer.",
  notes_too_long: "Votre message est trop long (1000 caractères maximum).",
  invalid_party_size: "Nombre de participants invalide.",
  invalid_range: "Période invalide.",
  otp_expired: "Ce code a expiré ou est incorrect. Demandez-en un nouveau.",
  over_email_send_rate_limit: "Trop de demandes. Patientez une minute avant de redemander un code.",
  email_address_invalid: "Adresse email invalide.",
};

const FALLBACK = "Une erreur est survenue. Vérifiez votre connexion et réessayez.";

export function toUserMessage(error: unknown): string {
  if (!error) return FALLBACK;
  const candidates: string[] = [];
  if (typeof error === "string") candidates.push(error);
  if (typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof code === "string") candidates.push(code);
    if (typeof message === "string") candidates.push(message);
  }
  for (const text of candidates) {
    for (const [key, message] of Object.entries(MESSAGES)) {
      if (text === key || text.includes(key)) return message;
    }
  }
  return FALLBACK;
}
