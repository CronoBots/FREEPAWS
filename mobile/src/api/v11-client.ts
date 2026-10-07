import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

// Cahier des charges v1.1, côté client : chiens du groupe, règles de santé, invités, questionnaire.

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export const v11Keys = {
  eligibility: (serviceId: string, startsAt: string, dogIds: string[], groupCount: number) =>
    ["v11", "eligibility", serviceId, startsAt, [...dogIds].sort().join(","), groupCount] as const,
  invitation: (token: string) => ["v11", "invitation", token] as const,
  questions: (serviceId: string) => ["v11", "questions", serviceId] as const,
  response: (bookingId: string) => ["v11", "response", bookingId] as const,
  bookingGroup: (bookingId: string) => ["v11", "booking-group", bookingId] as const,
};

// ---------------------------------------------------------------------------
// Chiens du groupe (M2-06)
// ---------------------------------------------------------------------------

export const DOG_SIZES = ["small", "medium", "large", "giant"] as const;
export type DogSize = (typeof DOG_SIZES)[number];

export type GroupDog = { name: string; breed: string | null; size: DogSize | null; protocol: boolean };

function parseGroupDogs(value: Json | undefined): GroupDog[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const name = typeof item.name === "string" ? item.name : "";
    if (!name) return [];
    const size = DOG_SIZES.find((candidate) => candidate === item.size) ?? null;
    return [
      { name, breed: typeof item.breed === "string" ? item.breed : null, size, protocol: item.protocol === true },
    ];
  });
}

/** Chiens d’autres foyers déclarés dans une réservation. */
export function useBookingGroup(bookingId: string | undefined) {
  return useQuery({
    queryKey: v11Keys.bookingGroup(bookingId ?? ""),
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const row = await run(
        supabase.from("bookings").select("group_dogs, group_certified_at").eq("id", bookingId!).maybeSingle(),
      );
      return { dogs: parseGroupDogs(row?.group_dogs), certifiedAt: row?.group_certified_at ?? null };
    },
  });
}

// ---------------------------------------------------------------------------
// Règles de santé : aperçu avant de confirmer (M2-09)
// ---------------------------------------------------------------------------

export type EligibilityWarning = { code: string; dog: string };
export type Eligibility = { error: string | null; warnings: EligibilityWarning[] };

export function useParkEligibility(input: {
  serviceId: string;
  startsAt: string | null;
  dogIds: string[];
  groupCount: number;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: v11Keys.eligibility(input.serviceId, input.startsAt ?? "", input.dogIds, input.groupCount),
    enabled: input.enabled && Boolean(input.startsAt),
    queryFn: async (): Promise<Eligibility> => {
      const data = await run(
        supabase.rpc("check_park_eligibility", {
          p_service_id: input.serviceId,
          p_starts_at: input.startsAt!,
          p_dog_ids: input.dogIds,
          p_group_count: input.groupCount,
        }),
      );
      const result = (data ?? {}) as { error?: unknown; warnings?: unknown };
      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      return {
        error: typeof result.error === "string" ? result.error : null,
        // Format serveur : « <code>:<nom du chien> ».
        warnings: warnings.flatMap((item) => {
          if (typeof item !== "string") return [];
          const index = item.indexOf(":");
          return index < 0 ? [{ code: item, dog: "" }] : [{ code: item.slice(0, index), dog: item.slice(index + 1) }];
        }),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Invitation des participants (M2-10)
// ---------------------------------------------------------------------------

export type GuestDocument = {
  id: string;
  kind: string;
  version: number;
  title: string;
  body: string;
  accepted: boolean;
};

export type GuestInvitation = {
  fullName: string;
  email: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  dog: GroupDog | null;
  profileCompleted: boolean;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  hostName: string | null;
  documents: GuestDocument[];
};

const str = (value: unknown) => (typeof value === "string" ? value : null);

/** Ce que voit l’invité en ouvrant son lien ; null si le lien est invalide ou expiré. */
export function useGuestInvitation(token: string | undefined) {
  const { language } = useLanguage();
  return useQuery({
    queryKey: [...v11Keys.invitation(token ?? ""), language],
    enabled: Boolean(token),
    queryFn: async (): Promise<GuestInvitation | null> => {
      const data = await run(supabase.rpc("get_guest_invitation", { p_token: token!, p_language: language }));
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      const row = data as Record<string, Json | undefined>;
      const documents = Array.isArray(row.documents) ? row.documents : [];
      return {
        fullName: str(row.full_name) ?? "",
        email: str(row.email),
        phone: str(row.phone),
        emergencyContactName: str(row.emergency_contact_name),
        emergencyContactPhone: str(row.emergency_contact_phone),
        dog: parseGroupDogs(row.dog ? [row.dog] : [])[0] ?? null,
        profileCompleted: row.profile_completed === true,
        startsAt: str(row.starts_at) ?? "",
        endsAt: str(row.ends_at) ?? "",
        serviceName: str(row.service_name) ?? "",
        hostName: str(row.host_name),
        documents: documents.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const id = str(item.id);
          if (!id) return [];
          return [
            {
              id,
              kind: str(item.kind) ?? "",
              version: typeof item.version === "number" ? item.version : 1,
              title: str(item.title) ?? "",
              body: str(item.body) ?? "",
              accepted: item.accepted === true,
            },
          ];
        }),
      };
    },
  });
}

export type GuestProfileInput = {
  full_name: string;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  dog: GroupDog | null;
};

export function useCompleteGuestProfile(token: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ profile, documentIds }: { profile: GuestProfileInput; documentIds: string[] }) => {
      await run(
        supabase.rpc("complete_guest_profile", {
          p_token: token ?? "",
          p_profile: profile,
          p_document_ids: documentIds,
        }),
      );
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: v11Keys.invitation(token ?? "") }),
        client.invalidateQueries({ queryKey: ["guest-live", token] }),
      ]),
  });
}

// ---------------------------------------------------------------------------
// Questionnaire pré-visite (M1-05 / M1-11)
// ---------------------------------------------------------------------------

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

export type Question = {
  id: string;
  kind: QuestionKind;
  label: string;
  help: string | null;
  required: boolean;
  options: { value: string; label: string }[];
};

/** Valeur enregistrée : texte / date (AAAA-MM-JJ) / choix unique → chaîne, oui-non → booléen,
 *  nombre → nombre, choix multiples → liste des valeurs. */
export type AnswerValue = string | number | boolean | string[];
export type Answers = Record<string, AnswerValue>;

/** Questions actives d’une prestation, triées, avec libellés dans la langue de l’app. */
export function useQuestions(serviceId: string | undefined) {
  const { language } = useLanguage();
  return useQuery({
    queryKey: [...v11Keys.questions(serviceId ?? ""), language],
    enabled: Boolean(serviceId),
    queryFn: async (): Promise<Question[]> => {
      const rows = await run(
        supabase
          .from("questionnaire_questions")
          .select("id, kind, label, help, required, options, translations, position, created_at")
          .eq("service_id", serviceId!)
          .eq("active", true)
          .order("position")
          .order("created_at"),
      );
      return (rows ?? []).flatMap((row) => {
        const kind = QUESTION_KINDS.find((candidate) => candidate === row.kind);
        if (!kind) return [];
        const translations = row.translations as Record<string, { label?: unknown; help?: unknown } | undefined>;
        const en = language === "en" && translations && typeof translations === "object" ? translations.en : undefined;
        const options = Array.isArray(row.options) ? row.options : [];
        return [
          {
            id: row.id,
            kind,
            required: row.required,
            label: str(en?.label) || row.label,
            help: str(en?.help) || row.help,
            options: options.flatMap((option) => {
              if (!option || typeof option !== "object" || Array.isArray(option)) return [];
              const value = str(option.value);
              if (!value) return [];
              const label = (language === "en" ? str(option.label_en) : null) || str(option.label) || value;
              return [{ value, label }];
            }),
          },
        ];
      });
    },
  });
}

export function useQuestionnaireResponse(bookingId: string | undefined) {
  return useQuery({
    queryKey: v11Keys.response(bookingId ?? ""),
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const row = await run(
        supabase
          .from("questionnaire_responses")
          .select("answers, submitted_at, updated_at")
          .eq("booking_id", bookingId!)
          .maybeSingle(),
      );
      if (!row) return null;
      const answers =
        row.answers && typeof row.answers === "object" && !Array.isArray(row.answers) ? (row.answers as Answers) : {};
      return { answers, submittedAt: row.submitted_at, updatedAt: row.updated_at };
    },
  });
}

export function useSubmitQuestionnaire() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, answers }: { bookingId: string; answers: Answers }) => {
      await run(supabase.rpc("submit_questionnaire", { p_booking_id: bookingId, p_answers: answers }));
    },
    onSettled: (_data, _error, { bookingId }) => client.invalidateQueries({ queryKey: v11Keys.response(bookingId) }),
  });
}
