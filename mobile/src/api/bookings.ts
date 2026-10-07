import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { localizeContent } from "@/api/services";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { parseRange } from "@/utils/range";

const BOOKING_SELECT = `
  id, status, client_notes, party_size, created_at, cancelled_at,
  visit_address, adults_count, children_count, dogs_count, price_cents, discount_cents,
  dog:dogs ( id, name ),
  appointment:appointments (
    id, period, status,
    service:services ( id, slug, name, location, mode, booking_enabled, cancel_notice_hours, duration_minutes, max_advance_days, translations )
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
    return [{ ...row, appointment: row.appointment, service: localizeContent(row.appointment.service), start, end }];
  });
}

export type Booking = Awaited<ReturnType<typeof fetchBookings>>[number];

export function isUpcoming(booking: Booking, now = new Date()) {
  return booking.status === "confirmed" && booking.end > now;
}

/** Report possible pour un créneau individuel, dans le même délai que l’annulation. */
export function canReschedule(booking: Booking, now = new Date()) {
  return canCancel(booking, now) && booking.service.mode === "slot" && booking.service.booking_enabled;
}

export function canCancel(booking: Booking, now = new Date()) {
  const deadline = booking.start.getTime() - booking.service.cancel_notice_hours * 3_600_000;
  return booking.status === "confirmed" && now.getTime() < deadline;
}

export function useMyBookings() {
  const { userId } = useAuth();
  const { language } = useLanguage();
  return useQuery({
    queryKey: [...queryKeys.myBookings(userId), language],
    enabled: Boolean(userId),
    queryFn: async () => {
      const bookings = await fetchBookings({ clientId: userId! });
      return bookings.sort((a, b) => a.start.getTime() - b.start.getTime());
    },
  });
}

export function useBooking(id: string | undefined) {
  const { language } = useLanguage();
  return useQuery({
    queryKey: [...queryKeys.booking(id ?? ""), language],
    enabled: Boolean(id),
    queryFn: async () => (await fetchBookings({ id: id! }))[0] ?? null,
  });
}

/** Toute écriture touchant l’agenda rafraîchit ces quatre vues ensemble. */
export function useInvalidateBookings() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.allBookings }),
      client.invalidateQueries({ queryKey: queryKeys.allSlots }),
      client.invalidateQueries({ queryKey: queryKeys.parkStatus }),
      client.invalidateQueries({ queryKey: queryKeys.allAgenda }),
    ]);
}

/** Informations communes à toute réservation (selon la prestation). */
export type BookingDetails = {
  dogId: string | null;
  notes: string;
  visitAddress?: string;
  adultsCount?: number;
  childrenCount?: number;
  dogsCount?: number;
  discountCode?: string;
  documentIds?: string[];
};

function detailArgs(details: BookingDetails) {
  return {
    p_dog_id: details.dogId ?? undefined,
    p_notes: details.notes || undefined,
    p_adults_count: details.adultsCount,
    p_children_count: details.childrenCount,
    p_dogs_count: details.dogsCount,
    p_discount_code: details.discountCode?.trim() || undefined,
    p_document_ids: details.documentIds?.length ? details.documentIds : undefined,
  };
}

export function useBookSlot() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (input: BookingDetails & { serviceId: string; startsAt: string }) => {
      const { data, error } = await supabase.rpc("book_slot", {
        p_service_id: input.serviceId,
        p_starts_at: input.startsAt,
        p_visit_address: input.visitAddress?.trim() || undefined,
        ...detailArgs(input),
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
    mutationFn: async (input: BookingDetails & { appointmentId: string }) => {
      const { data, error } = await supabase.rpc("book_event", {
        p_appointment_id: input.appointmentId,
        ...detailArgs(input),
      });
      if (error) throw error;
      return data;
    },
    onSettled: invalidate,
  });
}

export function useRescheduleBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async (input: { bookingId: string; startsAt: string }) => {
      const { error } = await supabase.rpc("reschedule_booking", {
        p_booking_id: input.bookingId,
        p_starts_at: input.startsAt,
      });
      if (error) throw error;
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
