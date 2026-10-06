import { useMutation, useQuery } from "@tanstack/react-query";

import { useInvalidateBookings } from "@/api/bookings";

import { queryKeys } from "@/api/keys";
import { supabase } from "@/lib/supabase";
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
           bookings ( id, status, party_size, client_notes,
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
