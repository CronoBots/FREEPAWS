import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { supabase } from "@/lib/supabase";

export type Slot = {
  appointmentId: string | null;
  startsAt: string;
  endsAt: string;
  remaining: number;
};

export function useSlots(serviceId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.slots(serviceId ?? "", from, to),
    enabled: Boolean(serviceId),
    staleTime: 15_000,
    queryFn: async (): Promise<Slot[]> => {
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_service_id: serviceId!,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return data.map((row) => ({
        appointmentId: row.appointment_id ?? null,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        remaining: row.remaining,
      }));
    },
  });
}
