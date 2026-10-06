export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "",
  contactEmail: "contact@freepaws.be",
  websiteUrl: "https://www.freepaws.be",
  /**
   * Compte de démonstration pour les équipes de review Apple / Google, qui ne peuvent pas
   * recevoir de code par email : cette adresse se connecte avec un mot de passe.
   */
  reviewEmail: (process.env.EXPO_PUBLIC_REVIEW_EMAIL ?? "").trim().toLowerCase(),
} as const;

export const isSupabaseConfigured =
  env.supabaseUrl.startsWith("http") && env.supabaseKey.length > 0 && !env.supabaseUrl.includes("REMPLACER");
