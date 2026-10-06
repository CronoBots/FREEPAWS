import { Fraunces_400Regular } from "@expo-google-fonts/fraunces/400Regular";
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { WorkSans_400Regular } from "@expo-google-fonts/work-sans/400Regular";
import { WorkSans_500Medium } from "@expo-google-fonts/work-sans/500Medium";
import { WorkSans_600SemiBold } from "@expo-google-fonts/work-sans/600SemiBold";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ConfigMissing } from "@/screens/config-missing";
import { AuthProvider, useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { queryClient } from "@/lib/query-client";
import { colors, fonts } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator fontsReady={fontsLoaded || Boolean(fontError)} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useAuth();
  const appReady = fontsReady && ready;

  useEffect(() => {
    if (appReady) void SplashScreen.hideAsync();
  }, [appReady]);

  // On garde le splash tant que la session persistée n’est pas relue (évite un flash « déconnecté »).
  if (!appReady) return null;
  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.serif, color: colors.ink },
        headerShadowVisible: false,
        // Titre centré partout : aligné avec la colonne de contenu, y compris sur tablette et web.
        headerTitleAlign: "center",
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "FreePaws" }} />
      <Stack.Screen name="sign-in" options={{ presentation: "modal", title: "Connexion" }} />
      <Stack.Screen name="service/[slug]" options={{ title: "" }} />
      <Stack.Screen name="booking/[id]" options={{ title: "Réservation" }} />
      <Stack.Screen name="profile" options={{ title: "Mes informations" }} />
      <Stack.Screen name="dogs/index" options={{ title: "Mes chiens" }} />
      <Stack.Screen name="dogs/[id]" options={{ title: "Chien" }} />
      <Stack.Screen name="legal" options={{ title: "Confidentialité" }} />
      <Stack.Screen name="admin/index" options={{ title: "Agenda" }} />
      <Stack.Screen name="admin/new-event" options={{ presentation: "modal", title: "Planifier un atelier" }} />
    </Stack>
  );
}
