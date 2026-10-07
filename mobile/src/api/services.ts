import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { getLanguage, useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

type Translated = Partial<Record<"name" | "summary" | "description" | "location", string>>;

/** Prestation avec ses textes dans la langue courante et le prix seulement s’il doit être affiché. */
export type Service = Tables<"services"> & { displayPriceCents: number | null };

/** Prestation de réservation du parc (fermée tant que le parc n’est pas ouvert). */
export const PARK_SERVICE_SLUG = "park-session";

/** Applique la traduction de la langue courante (repli sur le français). */
export function localizeContent<T extends Partial<Record<keyof Translated, string>> & { translations?: unknown }>(
  row: T,
  language = getLanguage(),
): T {
  const all = (row.translations ?? {}) as Record<string, Translated>;
  const tr = language === "fr" ? undefined : all[language];
  if (!tr) return row;
  return {
    ...row,
    ...(tr.name ? { name: tr.name } : null),
    ...(tr.summary ? { summary: tr.summary } : null),
    ...(tr.description ? { description: tr.description } : null),
    ...(tr.location ? { location: tr.location } : null),
  };
}

async function fetchServices(): Promise<Tables<"services">[]> {
  const { data, error } = await supabase.from("services").select("*").eq("active", true).order("sort_order");
  if (error) throw error;
  return data;
}

export function useServices() {
  const { language } = useLanguage();
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: fetchServices,
    staleTime: 5 * 60_000,
    select: (rows): Service[] =>
      rows.map((row) => ({
        ...localizeContent(row, language),
        displayPriceCents: row.price_visible ? row.price_cents : null,
      })),
  });
}

export function useService(slug: string | undefined) {
  const query = useServices();
  return { ...query, data: query.data?.find((service) => service.slug === slug) };
}
