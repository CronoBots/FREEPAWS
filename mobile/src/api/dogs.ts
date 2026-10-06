import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/api/keys";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/types/database";

export type Dog = Tables<"dogs">;
export type DogInput = Pick<TablesInsert<"dogs">, "name" | "breed" | "birth_date" | "notes">;

export function useDogs() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: queryKeys.dogs(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("dogs").select("*").eq("owner_id", userId!).order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveDog() {
  const client = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...input }: DogInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from("dogs").update(input).eq("id", id)
        : await supabase.from("dogs").insert(input);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.dogs(userId) }),
  });
}

export function useDeleteDog() {
  const client = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dogs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.dogs(userId) }),
  });
}
