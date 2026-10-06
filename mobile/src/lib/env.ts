export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "",
  contactEmail: "contact@freepaws.be",
  websiteUrl: "https://www.freepaws.be",
} as const;

export const isSupabaseConfigured =
  env.supabaseUrl.startsWith("http") && env.supabaseKey.length > 0 && !env.supabaseUrl.includes("REMPLACER");
