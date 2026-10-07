import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/types/database";

// Fiches du parc côté client : vaccinations, invités, urgence, liste d’attente, export RGPD.

export const parkKeys = {
  vaccineTypes: ["vaccine-types"] as const,
  vaccinations: (dogId: string) => ["vaccinations", dogId] as const,
  allVaccinations: ["vaccinations"] as const,
  bookingExtras: (bookingId: string) => ["booking-extras", bookingId] as const,
  rescueInfo: ["rescue-info"] as const,
  waitlist: (userId: string | null) => ["waitlist", userId] as const,
};

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export type VaccineType = Tables<"vaccine_types">;
export type Vaccination = Tables<"dog_vaccinations"> & { vaccine: { name: string; translations: unknown } | null };

/** Vaccins paramétrés par l’administratrice (actifs uniquement). */
export function useVaccineTypes() {
  return useQuery({
    queryKey: parkKeys.vaccineTypes,
    queryFn: () => run(supabase.from("vaccine_types").select("*").eq("active", true).order("sort_order").order("name")),
  });
}

export function useVaccinations(dogId: string | undefined) {
  return useQuery({
    queryKey: parkKeys.vaccinations(dogId ?? ""),
    enabled: Boolean(dogId),
    queryFn: async () =>
      (await run(
        supabase
          .from("dog_vaccinations")
          .select("*, vaccine:vaccine_types ( name, translations )")
          .eq("dog_id", dogId!)
          .order("valid_until", { ascending: false }),
      )) as Vaccination[],
  });
}

export type VaccinationInput = Pick<
  TablesInsert<"dog_vaccinations">,
  "dog_id" | "vaccine_type_id" | "vaccinated_on" | "valid_until" | "proof_path"
>;

export function useSaveVaccination() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: VaccinationInput & { id?: string }) => {
      await run(
        id
          ? supabase.from("dog_vaccinations").update(input).eq("id", id).select("id")
          : supabase.from("dog_vaccinations").insert(input).select("id"),
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: parkKeys.allVaccinations }),
  });
}

export function useDeleteVaccination() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await run(supabase.from("dog_vaccinations").delete().eq("id", id).select("id"));
    },
    onSettled: () => client.invalidateQueries({ queryKey: parkKeys.allVaccinations }),
  });
}

/** Chiens et invités d’une réservation. */
export function useBookingExtras(bookingId: string | undefined) {
  return useQuery({
    queryKey: parkKeys.bookingExtras(bookingId ?? ""),
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const [dogs, guests] = await Promise.all([
        run(supabase.from("booking_dogs").select("dog:dogs ( id, name, breed )").eq("booking_id", bookingId!)),
        run(supabase.from("booking_guests").select("*").eq("booking_id", bookingId!).order("created_at")),
      ]);
      return { dogs: (dogs ?? []).map((row) => row.dog).filter((dog) => dog != null), guests: guests ?? [] };
    },
  });
}

export type GuestInput = { full_name: string; email?: string | null; phone?: string | null };

export function useSetBookingGuests() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, guests }: { bookingId: string; guests: GuestInput[] }) => {
      await run(supabase.rpc("set_booking_guests", { p_booking_id: bookingId, p_guests: guests }));
    },
    onSettled: (_data, _error, { bookingId }) =>
      client.invalidateQueries({ queryKey: parkKeys.bookingExtras(bookingId) }),
  });
}

/** Bouton « Urgence » : alerte immédiate à l’administratrice (réservation en cours uniquement). */
export function useRaiseEmergency() {
  return useMutation({
    mutationFn: async (message: string | null) =>
      run(supabase.rpc("raise_emergency", { p_message: message ?? undefined })),
  });
}

/** Fiche secours rédigée par l’administratrice (adresse, accès, trousse de secours…). */
export function useRescueInfo(enabled = true) {
  return useQuery({
    queryKey: parkKeys.rescueInfo,
    enabled,
    queryFn: () => run(supabase.rpc("get_rescue_info")),
  });
}

export function useMyWaitlist() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: parkKeys.waitlist(userId),
    enabled: Boolean(userId),
    queryFn: () =>
      run(
        supabase
          .from("waitlist_entries")
          .select("*")
          .is("notified_at", null)
          .gte("day", new Date().toISOString().slice(0, 10)),
      ),
  });
}

export function useJoinWaitlist() {
  const client = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ serviceId, day }: { serviceId: string; day: string }) => {
      const { error } = await supabase.from("waitlist_entries").insert({ service_id: serviceId, day });
      // Déjà inscrit : pas une erreur pour l’utilisateur.
      if (error && error.code !== "23505") throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: parkKeys.waitlist(userId) }),
  });
}

export function useLeaveWaitlist() {
  const client = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      await run(supabase.from("waitlist_entries").delete().eq("id", id).select("id"));
    },
    onSettled: () => client.invalidateQueries({ queryKey: parkKeys.waitlist(userId) }),
  });
}

/** Droit d’accès RGPD : toutes les données du compte. */
export async function exportMyData(): Promise<unknown> {
  return run(supabase.rpc("export_my_data"));
}
