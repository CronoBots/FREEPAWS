import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
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

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      // Le compte n'existe plus : on purge la session locale.
      await supabase.auth.signOut({ scope: "local" });
    },
  });
}
