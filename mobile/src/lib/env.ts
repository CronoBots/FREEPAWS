export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "",
  contactEmail: "contact@freepaws.be",
  websiteUrl: "https://www.freepaws.be",
  /**
   * Adresse web de l’app une fois publiée (ex. https://app.freepaws.be, hébergeable chez Infomaniak) :
   * sert aux liens envoyés aux invités et aux secours. Sans elle, les liens ouvrent l’app (freepaws://).
   */
  appUrl: (process.env.EXPO_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, ""),
  /**
   * Compte de démonstration pour les équipes de review Apple / Google, qui ne peuvent pas
   * recevoir de code par email : cette adresse se connecte avec un mot de passe.
   */
  reviewEmail: (process.env.EXPO_PUBLIC_REVIEW_EMAIL ?? "").trim().toLowerCase(),
} as const;

export const isSupabaseConfigured =
  env.supabaseUrl.startsWith("http") && env.supabaseKey.length > 0 && !env.supabaseUrl.includes("REMPLACER");
