import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminParkKeys } from "@/api/admin-park";
import { useInvalidateBookings } from "@/api/bookings";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

// Rendez-vous posé par l’administratrice pour un client ; accès temporaire des secours (M9-04).

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export function useAdminBookForClient() {
  const invalidate = useInvalidateBookings();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      serviceId: string;
      clientId: string;
      startsAt: Date;
      durationMinutes: number;
      visitAddress: string | null;
      notes: string | null;
      priceCents: number | null;
    }) =>
      run(
        supabase.rpc("admin_book_for_client", {
          p_service_id: input.serviceId,
          p_client_id: input.clientId,
          p_starts_at: input.startsAt.toISOString(),
          p_duration_minutes: input.durationMinutes,
          p_visit_address: input.visitAddress ?? undefined,
          p_notes: input.notes ?? undefined,
          p_price_cents: input.priceCents ?? undefined,
        }),
      ),
    onSettled: async () => {
      await invalidate();
      await client.invalidateQueries({ queryKey: adminParkKeys.allClient });
    },
  });
}

export type RescueAccess = Tables<"rescue_access">;
const rescueKey = ["admin", "rescue-access"] as const;

export function useRescueAccesses() {
  return useQuery({
    queryKey: rescueKey,
    queryFn: async () =>
      (await run(
        supabase
          .from("rescue_access")
          .select("*")
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
      )) ?? [],
  });
}

export function useCreateRescueAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ label, hours }: { label: string; hours: number }) =>
      run(
        supabase
          .from("rescue_access")
          .insert({ label, expires_at: new Date(Date.now() + hours * 3_600_000).toISOString() })
          .select("*")
          .single(),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: rescueKey }),
  });
}

export function useRevokeRescueAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await run(
        supabase.from("rescue_access").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id"),
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: rescueKey }),
  });
}

export type RescueLive = {
  mode: "rescue" | "denied";
  expiresAt?: string | null;
  rescueInfo?: string;
  label?: string;
  streams: { id: string; name: string; url: string }[];
};

/** Page des secours : direct de toutes les caméras et fiche secours, rafraîchi avant expiration. */
export function useRescueLive(token: string | undefined) {
  return useQuery({
    queryKey: ["rescue-live", token],
    enabled: Boolean(token),
    refetchInterval: 60_000,
    queryFn: async (): Promise<RescueLive> => {
      const { data, error } = await supabase.functions.invoke("live-stream", { body: { rescue_token: token } });
      if (error) throw error;
      return data as RescueLive;
    },
  });
}
