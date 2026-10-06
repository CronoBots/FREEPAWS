import type { Session } from "@supabase/supabase-js";
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

type AuthState = {
  session: Session | null;
  userId: string | null;
  /** false tant que la session persistée n'a pas été relue : ne rien décider avant. */
  ready: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, userId: null, ready: false });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => mounted && setSession(data.session))
      .finally(() => mounted && setReady(true));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, userId: session?.user.id ?? null, ready }), [session, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
