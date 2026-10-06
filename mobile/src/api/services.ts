import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type Service = Tables<"services">;

/** Prestation de réservation du parc, à créer par FreePaws à l’ouverture (aucune n’existe encore). */
export const PARK_SERVICE_SLUG = "park-session";

async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase.from("services").select("*").eq("active", true).order("sort_order");
  if (error) throw error;
  return data;
}

export function useServices() {
  return useQuery({ queryKey: queryKeys.services, queryFn: fetchServices, staleTime: 5 * 60_000 });
}

export function useService(slug: string | undefined) {
  const query = useServices();
  return { ...query, data: query.data?.find((service) => service.slug === slug) };
}
