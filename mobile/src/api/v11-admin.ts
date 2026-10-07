import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { EmergencyBooking } from "@/api/admin-park";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { parseRange } from "@/utils/range";

// Écrans admin du cahier v1.1 : questionnaire pré-visite, fiche réservation, badges de l’agenda.

export const v11AdminKeys = {
  all: ["v11Admin"] as const,
  questions: (serviceId: string) => ["v11Admin", "questions", serviceId] as const,
  allQuestions: ["v11Admin", "questions"] as const,
  booking: (id: string) => ["v11Admin", "booking", id] as const,
  bookingInfo: (ids: string) => ["v11Admin", "booking-info", ids] as const,
};

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export const QUESTION_KINDS = [
  "text",
  "long_text",
  "yes_no",
  "single_choice",
  "multi_choice",
  "number",
  "date",
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export type QuestionOption = { value: string; label: string; label_en?: string };
export type QuestionTranslations = { en?: { label?: string; help?: string } };
export type Question = Tables<"questionnaire_questions">;

export function isChoiceKind(kind: string) {
  return kind === "single_choice" || kind === "multi_choice";
}

export function questionOptions(question: { options: unknown }): QuestionOption[] {
  return Array.isArray(question.options) ? (question.options as QuestionOption[]) : [];
}

export function questionTranslations(question: { translations: unknown }): QuestionTranslations {
  const value = question.translations;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as QuestionTranslations) : {};
}

// --- Questions (écriture réservée à l’administratrice) ----------------------------------------

/** Toutes les questions de la prestation (actives et inactives), dans l’ordre d’affichage. */
export function useQuestionnaireQuestions(serviceId: string | undefined) {
  return useQuery({
    queryKey: v11AdminKeys.questions(serviceId ?? ""),
    enabled: Boolean(serviceId),
    queryFn: () =>
      run(
        supabase
          .from("questionnaire_questions")
          .select("*")
          .eq("service_id", serviceId!)
          .order("position")
          .order("created_at"),
      ),
  });
}

function useInvalidating<T>(fn: (input: T) => Promise<void>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => client.invalidateQueries({ queryKey: v11AdminKeys.all }),
  });
}

export type QuestionInput =
  | ({ id?: undefined } & TablesInsert<"questionnaire_questions">)
  | ({ id: string } & TablesUpdate<"questionnaire_questions">);

export function useSaveQuestion() {
  return useInvalidating(async (input: QuestionInput) => {
    if (input.id) {
      const { id, ...values } = input;
      await run(supabase.from("questionnaire_questions").update(values).eq("id", id).select("id"));
    } else {
      await run(
        supabase
          .from("questionnaire_questions")
          .insert(input as TablesInsert<"questionnaire_questions">)
          .select("id"),
      );
    }
  });
}

export function useDeleteQuestion() {
  return useInvalidating(async (id: string) => {
    await run(supabase.from("questionnaire_questions").delete().eq("id", id).select("id"));
  });
}

/** Renumérote les questions dans l’ordre donné (seules celles qui changent sont mises à jour). */
export function useReorderQuestions() {
  return useInvalidating(async (ordered: Pick<Question, "id" | "position">[]) => {
    await Promise.all(
      ordered.map((question, index) =>
        question.position === index
          ? Promise.resolve()
          : run(
              supabase.from("questionnaire_questions").update({ position: index }).eq("id", question.id).select("id"),
            ),
      ),
    );
  });
}

// --- Fiche réservation ------------------------------------------------------------------------

export type GroupDog = { name: string; breed: string | null; size: string | null; protocol: boolean };
export type SnapshotQuestion = { id: string; label: string; kind: string; options: QuestionOption[] };

export function asGroupDogs(value: unknown): GroupDog[] {
  return Array.isArray(value) ? (value as GroupDog[]).filter((dog) => dog && typeof dog.name === "string") : [];
}

export function asGroupDog(value: unknown): GroupDog | null {
  return value && typeof value === "object" && typeof (value as GroupDog).name === "string"
    ? (value as GroupDog)
    : null;
}

export function useAdminBooking(id: string | undefined) {
  return useQuery({
    queryKey: v11AdminKeys.booking(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const booking = await run(
        supabase
          .from("bookings")
          .select(
            `id, status, created_at, cancelled_at, client_notes, visit_address, adults_count, children_count, dogs_count,
             party_size, price_cents, discount_cents, group_dogs, group_certified_at, health_warnings,
             appointment:appointments ( period, service:services ( id, name, mode ) ),
             client:profiles!bookings_client_id_fkey ( id, full_name, email, phone ),
             dog:dogs ( id, name, breed, size, protocol ),
             booking_dogs ( dog:dogs ( id, name, breed, size, protocol ) ),
             guests:booking_guests ( id, full_name, phone, email, emergency_contact_name, emergency_contact_phone,
               dog, profile_completed_at )`,
          )
          .eq("id", id!)
          .maybeSingle(),
      );
      if (!booking) return null;
      const serviceId = booking.appointment?.service?.id;
      const [response, questionCount] = await Promise.all([
        run(supabase.from("questionnaire_responses").select("*").eq("booking_id", booking.id).maybeSingle()),
        serviceId
          ? supabase
              .from("questionnaire_questions")
              .select("id", { count: "exact", head: true })
              .eq("service_id", serviceId)
              .eq("active", true)
              .then(({ count, error }) => {
                if (error) throw error;
                return count ?? 0;
              })
          : Promise.resolve(0),
      ]);
      const period = typeof booking.appointment?.period === "string" ? parseRange(booking.appointment.period) : null;
      const ownDogs = [booking.dog, ...booking.booking_dogs.map((row) => row.dog)].filter(
        (dog, index, list): dog is NonNullable<typeof dog> =>
          dog != null && list.findIndex((other) => other?.id === dog.id) === index,
      );
      return {
        ...booking,
        start: period?.start ?? null,
        end: period?.end ?? null,
        ownDogs,
        groupDogs: asGroupDogs(booking.group_dogs),
        response,
        hasQuestionnaire: questionCount > 0 || response != null,
      };
    },
  });
}

export type AdminBooking = NonNullable<ReturnType<typeof useAdminBooking>["data"]>;

/** Pour l’agenda : avertissements de santé et état du questionnaire de chaque réservation. */
export function useBookingsInfo(bookingIds: string[]) {
  const ids = [...new Set(bookingIds)].sort();
  return useQuery({
    queryKey: v11AdminKeys.bookingInfo(ids.join(",")),
    enabled: ids.length > 0,
    queryFn: async () => {
      const [bookings, responses] = await Promise.all([
        run(
          supabase
            .from("bookings")
            .select("id, health_warnings, appointment:appointments ( service_id )")
            .in("id", ids),
        ),
        run(supabase.from("questionnaire_responses").select("booking_id").in("booking_id", ids)),
      ]);
      const serviceIds = [
        ...new Set((bookings ?? []).map((b) => b.appointment?.service_id).filter((v): v is string => Boolean(v))),
      ];
      const questions = serviceIds.length
        ? await run(
            supabase
              .from("questionnaire_questions")
              .select("service_id")
              .in("service_id", serviceIds)
              .eq("active", true),
          )
        : [];
      const withQuestions = new Set((questions ?? []).map((q) => q.service_id));
      const received = new Set((responses ?? []).map((r) => r.booking_id));
      return new Map(
        (bookings ?? []).map((b) => [
          b.id,
          {
            healthWarnings: b.health_warnings,
            hasQuestionnaire: withQuestions.has(b.appointment?.service_id ?? "") || received.has(b.id),
            questionnaireReceived: received.has(b.id),
          },
        ]),
      );
    },
  });
}

export type BookingInfo =
  NonNullable<ReturnType<typeof useBookingsInfo>["data"]> extends Map<string, infer V> ? V : never;

// --- Mode urgence -----------------------------------------------------------------------------

/** `get_emergency_overview()` renvoie aussi les chiens du groupe, les avertissements et le profil des invités. */
export type EmergencyBookingV11 = Omit<EmergencyBooking, "guests"> & {
  group_dogs?: GroupDog[] | null;
  health_warnings?: string[] | null;
  guests: {
    full_name: string;
    phone: string | null;
    email: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    dog?: GroupDog | null;
    profile_completed?: boolean;
  }[];
};
