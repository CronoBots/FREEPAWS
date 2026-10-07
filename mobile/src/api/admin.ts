import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useInvalidateBookings } from "@/api/bookings";

import { queryKeys } from "@/api/keys";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { parseRange, toRangeLiteral } from "@/utils/range";

/** Agenda complet (admin) entre deux instants. */
export function useAgenda(from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: queryKeys.agenda(fromIso, toIso),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `id, period, status, capacity,
           service:services ( name, mode, location ),
           bookings ( id, status, party_size, client_notes, visit_address, adults_count, children_count, dogs_count,
             client:profiles!bookings_client_id_fkey ( full_name, email, phone ),
             dog:dogs ( name, breed ) )`,
        )
        .eq("status", "scheduled")
        .overlaps("period", toRangeLiteral(from, to))
        .order("period");
      if (error) throw error;
      return data.map((row) => ({
        ...row,
        ...parseRange(row.period as string),
        bookings: row.bookings.filter((booking) => booking.status === "confirmed"),
      }));
    },
  });
}

export type AgendaEntry = NonNullable<ReturnType<typeof useAgenda>["data"]>[number];

export function useCancelAppointment() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** Planifie une séance de groupe (atelier). L’agenda refuse tout chevauchement. */
export function useCreateEvent() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (input: {
      serviceId: string;
      resourceId: string;
      start: Date;
      durationMinutes: number;
      capacity: number;
    }) => {
      const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);
      const { error } = await supabase.from("appointments").insert({
        service_id: input.serviceId,
        resource_id: input.resourceId,
        period: toRangeLiteral(input.start, end),
        capacity: input.capacity,
      });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Configuration sans développeur (prestations, horaires, fermetures, codes, documents)
// ---------------------------------------------------------------------------

function useAdminMutation<T>(fn: (input: T) => Promise<void>, keys: readonly (readonly unknown[])[]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export const adminKeys = {
  resources: ["admin", "resources"] as const,
  services: ["admin", "services"] as const,
  rules: ["admin", "rules"] as const,
  blackouts: ["admin", "blackouts"] as const,
  codes: ["admin", "codes"] as const,
  settings: ["admin", "settings"] as const,
  documents: ["admin", "documents"] as const,
};

export function useResources() {
  return useQuery({
    queryKey: adminKeys.resources,
    queryFn: () => run(supabase.from("resources").select("*").order("slug")),
  });
}

export function useAdminServices() {
  return useQuery({
    queryKey: adminKeys.services,
    queryFn: () => run(supabase.from("services").select("*").order("sort_order")),
  });
}

export function useUpdateService() {
  return useAdminMutation(
    async ({ id, ...values }: TablesUpdate<"services"> & { id: string }) => {
      await run(supabase.from("services").update(values).eq("id", id).select("id"));
    },
    [adminKeys.services, queryKeys.services, queryKeys.allSlots],
  );
}

export type AvailabilityRule = Tables<"availability_rules">;

export function useAvailabilityRules() {
  return useQuery({
    queryKey: adminKeys.rules,
    queryFn: () => run(supabase.from("availability_rules").select("*").order("weekday").order("start_time")),
  });
}

export function useAddRules() {
  return useAdminMutation(
    async (rows: TablesInsert<"availability_rules">[]) => {
      await run(supabase.from("availability_rules").insert(rows).select("id"));
    },
    [adminKeys.rules, queryKeys.allSlots],
  );
}

export function useDeleteRule() {
  return useAdminMutation(
    async (id: string) => {
      await run(supabase.from("availability_rules").delete().eq("id", id).select("id"));
    },
    [adminKeys.rules, queryKeys.allSlots],
  );
}

export function useBlackouts() {
  return useQuery({
    queryKey: adminKeys.blackouts,
    queryFn: async () => {
      // Fermetures saisies à la main : les indisponibilités importées d’un agenda sont gérées ailleurs.
      const rows = await run(supabase.from("blackouts").select("*").eq("source", "manual"));
      return (rows ?? [])
        .map((row) => ({ ...row, ...parseRange(row.period as string) }))
        .filter((row) => row.end > new Date())
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    },
  });
}

export async function countAppointmentsInPeriod(resourceId: string, start: Date, end: Date) {
  return run(
    supabase.rpc("count_appointments_in_period", {
      p_resource_id: resourceId,
      p_starts_at: start.toISOString(),
      p_ends_at: end.toISOString(),
    }),
  );
}

export function useClosePeriod() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { resourceId: string; start: Date; end: Date; reason: string; cancelExisting: boolean }) =>
      run(
        supabase.rpc("close_period", {
          p_resource_id: input.resourceId,
          p_starts_at: input.start.toISOString(),
          p_ends_at: input.end.toISOString(),
          p_reason: input.reason,
          p_cancel_existing: input.cancelExisting,
        }),
      ),
    onSettled: () =>
      Promise.all(
        [adminKeys.blackouts, queryKeys.allSlots, queryKeys.allAgenda, queryKeys.allBookings, queryKeys.parkStatus].map(
          (queryKey) => client.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

export function useDeleteBlackout() {
  return useAdminMutation(
    async (id: string) => {
      await run(supabase.from("blackouts").delete().eq("id", id).select("id"));
    },
    [adminKeys.blackouts, queryKeys.allSlots, queryKeys.parkStatus],
  );
}

export function useDiscountCodes() {
  return useQuery({
    queryKey: adminKeys.codes,
    queryFn: () =>
      run(supabase.from("discount_codes").select("*, bookings(count)").order("created_at", { ascending: false })),
  });
}

export function useCreateDiscountCode() {
  return useAdminMutation(
    async (row: TablesInsert<"discount_codes">) => {
      await run(supabase.from("discount_codes").insert(row).select("id"));
    },
    [adminKeys.codes],
  );
}

export function useUpdateDiscountCode() {
  return useAdminMutation(
    async ({ id, ...values }: TablesUpdate<"discount_codes"> & { id: string }) => {
      await run(supabase.from("discount_codes").update(values).eq("id", id).select("id"));
    },
    [adminKeys.codes],
  );
}

export function useSettings() {
  return useQuery({
    queryKey: adminKeys.settings,
    queryFn: () => run(supabase.from("settings").select("*").single()),
  });
}

export function useUpdateSettings() {
  return useAdminMutation(
    async (values: TablesUpdate<"settings">) => {
      await run(supabase.from("settings").update(values).eq("id", true).select("id"));
    },
    [adminKeys.settings],
  );
}

export function useLegalDocuments() {
  return useQuery({
    queryKey: adminKeys.documents,
    queryFn: () =>
      run(
        supabase
          .from("legal_documents")
          .select("*")
          .order("kind")
          .order("version", { ascending: false })
          .order("language"),
      ),
  });
}

export function useCreateDocument() {
  return useAdminMutation(
    async (row: TablesInsert<"legal_documents">) => {
      await run(supabase.from("legal_documents").insert(row).select("id"));
    },
    [adminKeys.documents],
  );
}

export function usePublishDocument() {
  return useAdminMutation(
    async (id: string) => {
      await run(
        supabase.from("legal_documents").update({ published_at: new Date().toISOString() }).eq("id", id).select("id"),
      );
    },
    [adminKeys.documents],
  );
}
