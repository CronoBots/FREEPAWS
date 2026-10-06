import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export type ParkStatus = { status: "free" | "reserved" | "closed" | "not_open"; until: string | null };

export function useParkStatus() {
  return useQuery({
    queryKey: queryKeys.parkStatus,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ParkStatus> => {
      const { data, error } = await supabase.rpc("get_resource_status", { p_resource_slug: "park" }).single();
      if (error) throw error;
      return { status: data.status as ParkStatus["status"], until: data.until ?? null };
    },
  });
}

export type LiveStream = {
  mode: "public" | "private" | "admin" | "denied";
  expiresAt?: string;
  streams: { id: string; name: string; url: string }[];
};

export function useLiveStream(enabled: boolean) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: queryKeys.liveStream(userId),
    enabled,
    // Les URLs signées expirent vite : on les renouvelle avant l'échéance.
    refetchInterval: (query) => {
      const expiresAt = query.state.data?.expiresAt;
      if (!expiresAt) return 60_000;
      return Math.max(15_000, new Date(expiresAt).getTime() - Date.now() - 30_000);
    },
    queryFn: async (): Promise<LiveStream> => {
      const { data, error } = await supabase.functions.invoke<LiveStream>("live-stream", { method: "POST" });
      if (error) throw error;
      return data ?? { mode: "denied", streams: [] };
    },
  });
}
