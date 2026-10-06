import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { parseRange } from "@/utils/range";

const BOOKING_SELECT = `
  id, status, client_notes, party_size, created_at, cancelled_at,
  dog:dogs ( id, name ),
  appointment:appointments (
    id, period, status,
    service:services ( id, slug, name, location, cancel_notice_hours, duration_minutes )
  )
` as const;

async function fetchBookings(filter: { id?: string; clientId?: string }) {
  let query = supabase.from("bookings").select(BOOKING_SELECT);
  if (filter.id) query = query.eq("id", filter.id);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  const { data, error } = await query;
  if (error) throw error;
  return data.flatMap((row) => {
    if (!row.appointment?.service) return [];
    const { start, end } = parseRange(row.appointment.period as string);
    return [{ ...row, appointment: row.appointment, service: row.appointment.service, start, end }];
  });
}

export type Booking = Awaited<ReturnType<typeof fetchBookings>>[number];

export function isUpcoming(booking: Booking, now = new Date()) {
  return booking.status === "confirmed" && booking.end > now;
}

export function canCancel(booking: Booking, now = new Date()) {
  const deadline = booking.start.getTime() - booking.service.cancel_notice_hours * 3_600_000;
  return booking.status === "confirmed" && now.getTime() < deadline;
}

export function useMyBookings() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: queryKeys.myBookings(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const bookings = await fetchBookings({ clientId: userId! });
      return bookings.sort((a, b) => a.start.getTime() - b.start.getTime());
    },
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.booking(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await fetchBookings({ id: id! }))[0] ?? null,
  });
}

function useInvalidateBookings() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.allBookings }),
      client.invalidateQueries({ queryKey: queryKeys.allSlots }),
      client.invalidateQueries({ queryKey: queryKeys.parkStatus }),
      client.invalidateQueries({ queryKey: queryKeys.allAgenda }),
    ]);
}

export function useBookSlot() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (input: { serviceId: string; startsAt: string; dogId: string | null; notes: string }) => {
      const { data, error } = await supabase.rpc("book_slot", {
        p_service_id: input.serviceId,
        p_starts_at: input.startsAt,
        p_dog_id: input.dogId ?? undefined,
        p_notes: input.notes || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSettled: invalidate,
  });
}

export function useBookEvent() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (input: { appointmentId: string; dogId: string | null; notes: string }) => {
      const { data, error } = await supabase.rpc("book_event", {
        p_appointment_id: input.appointmentId,
        p_dog_id: input.dogId ?? undefined,
        p_notes: input.notes || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSettled: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}
