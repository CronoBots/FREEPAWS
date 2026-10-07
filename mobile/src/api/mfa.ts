import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Double authentification (TOTP) de l’administratrice. Une fois un facteur vérifié, la base
// n’accorde les droits d’administration qu’aux sessions validées par code (aal2).

const mfaKeys = {
  assurance: (userId: string | null, accessToken: string | null) => ["mfa", "aal", userId, accessToken] as const,
  factors: (userId: string | null) => ["mfa", "factors", userId] as const,
  all: ["mfa"] as const,
};

export function useAssurance() {
  const { userId, session } = useAuth();
  return useQuery({
    queryKey: mfaKeys.assurance(userId, session?.access_token ?? null),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return { current: data.currentLevel, next: data.nextLevel };
    },
  });
}

export function useTotpFactors() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: mfaKeys.factors(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
  });
}

/** Démarre l’activation : retourne le QR code (SVG), la clé secrète et l’URI otpauth. */
export function useEnrollTotp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Une activation abandonnée laisse un facteur non vérifié : on le supprime d’abord.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const factor of list?.all ?? []) {
        if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "FreePaws" });
      if (error) throw error;
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
    },
    onSettled: () => client.invalidateQueries({ queryKey: mfaKeys.all }),
  });
}

/** Vérifie un code à 6 chiffres ; la session passe en aal2 et toutes les données sont rechargées. */
export function useVerifyTotp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useUnenrollTotp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await supabase.auth.refreshSession();
    },
    onSettled: () => client.invalidateQueries(),
  });
}
