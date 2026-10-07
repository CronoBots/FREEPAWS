import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@/api/keys";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export function useProfile() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: queryKeys.profile(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin() {
  return useProfile().data?.role === "admin";
}

export function useUpdateProfile() {
  const client = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (input: { full_name: string; phone: string | null }) => {
      const { error } = await supabase.from("profiles").update(input).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
  });
}

/** Garde profiles.language aligné sur la langue de l’app : les emails partent dans cette langue. */
export function useSyncProfileLanguage() {
  const { language } = useLanguage();
  const { userId } = useAuth();
  const profile = useProfile();
  const client = useQueryClient();
  const stored = profile.data?.language;
  useEffect(() => {
    if (!userId || !stored || stored === language) return;
    void supabase
      .from("profiles")
      .update({ language })
      .eq("id", userId)
      .then(({ error }) => {
        if (!error) void client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      });
  }, [client, language, stored, userId]);
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      // Le compte n’existe plus : on purge la session locale.
      await supabase.auth.signOut({ scope: "local" });
    },
  });
}
