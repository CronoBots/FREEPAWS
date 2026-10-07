import { t, type TranslationKey } from "@/i18n";

// Les fonctions SQL lèvent des codes stables (ex. « slot_unavailable ») ; on les traduit ici.
const CODES = [
  "slot_unavailable",
  "appointment_full",
  "appointment_cancelled",
  "already_booked",
  "too_many_bookings",
  "cancellation_too_late",
  "booking_in_past",
  "booking_not_found",
  "dog_not_found",
  "service_not_found",
  "not_authenticated",
  "notes_too_long",
  "invalid_party_size",
  "invalid_range",
  "resource_not_found",
  "address_required",
  "too_many_dogs",
  "discount_code_invalid",
  "discount_code_exhausted",
  "documents_not_accepted",
  "reschedule_not_allowed",
  "not_authorized",
  "otp_expired",
  "over_email_send_rate_limit",
  "email_address_invalid",
] as const;

export function toUserMessage(error: unknown): string {
  const candidates: string[] = [];
  if (typeof error === "string") candidates.push(error);
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof code === "string") candidates.push(code);
    if (typeof message === "string") candidates.push(message);
  }
  for (const text of candidates) {
    for (const code of CODES) {
      if (text === code || text.includes(code)) return t(`errors.${code}` as TranslationKey);
    }
  }
  return t("common.error");
}
