import { useQuery } from "@tanstack/react-query";

import { useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export type RequiredDocument = {
  documentId: string;
  kind: string;
  version: number;
  title: string;
  body: string;
  accepted: boolean;
};

/** Conditions (dernière version publiée) à accepter avant de réserver une prestation. */
export function useRequiredDocuments(serviceId: string | undefined) {
  const { userId } = useAuth();
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["documents", "required", serviceId, userId, language],
    enabled: Boolean(serviceId),
    queryFn: async (): Promise<RequiredDocument[]> => {
      const { data, error } = await supabase.rpc("get_required_documents", {
        p_service_id: serviceId!,
        p_language: language,
      });
      if (error) throw error;
      return data.map((row) => ({
        documentId: row.document_id,
        kind: row.kind,
        version: row.version,
        title: row.title,
        body: row.body,
        accepted: row.accepted,
      }));
    },
  });
}

/** Aperçu d’un code tarif social pour une prestation. */
export async function checkDiscountCode(serviceId: string, code: string) {
  const { data, error } = await supabase.rpc("check_discount_code", { p_service_id: serviceId, p_code: code }).single();
  if (error) throw error;
  return { valid: data.valid, priceCents: data.price_cents ?? null, discountCents: data.discount_cents ?? null };
}
