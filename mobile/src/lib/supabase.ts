import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import { env, isSupabaseConfigured } from "@/lib/env";
import { sessionStorage } from "@/lib/session-storage";
import type { Database } from "@/types/database";

export const supabase = createClient<Database>(
  isSupabaseConfigured ? env.supabaseUrl : "http://localhost:54321",
  isSupabaseConfigured ? env.supabaseKey : "missing-key",
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Sur mobile, on ne rafraîchit le jeton que lorsque l'app est au premier plan.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
