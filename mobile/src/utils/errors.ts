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
  "profile_incomplete",
  "not_adult",
  "insurance_missing",
  "insurance_expired",
  "dog_required",
  "dog_too_young",
  "dog_in_heat",
  "vaccination_missing",
  "too_many_people",
  "account_suspended",
  "no_current_booking",
  "last_admin",
  "user_not_found",
  "invalid_guests",
  "file_too_large",
  "dog_ill",
  "antiparasitic_missing",
  "feed_not_found",
  "otp_expired",
  "over_email_send_rate_limit",
  "email_address_invalid",
  "group_certification_required",
  "invalid_group_dogs",
  "questionnaire_incomplete",
  "invalid_answers",
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
  if (isNetworkError(error)) return t("common.networkError");
  return t("common.error");
}

// supabase-js : « TypeError: Failed to fetch » (web), « Network request failed » (natif),
// FunctionsFetchError pour les Edge Functions.
function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "FunctionsFetchError") return true;
  return (
    typeof message === "string" && /failed to fetch|network request failed|networkerror|load failed/i.test(message)
  );
}
