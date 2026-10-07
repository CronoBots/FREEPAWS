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
import { useEffect, useState } from "react";

import { usePushRegistration, useSyncProfileLanguage } from "@/api/profile";
import { ConfigMissing } from "@/screens/config-missing";
import { loadStoredLanguage, useLanguage } from "@/i18n";
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
  const [languageReady, setLanguageReady] = useState(false);
  const appReady = fontsReady && ready && languageReady;

  useEffect(() => {
    void loadStoredLanguage().finally(() => setLanguageReady(true));
  }, []);

  useEffect(() => {
    if (appReady) void SplashScreen.hideAsync();
  }, [appReady]);

  // On garde le splash tant que la session persistée n’est pas relue (évite un flash « déconnecté »).
  if (!appReady) return null;
  if (!isSupabaseConfigured) return <ConfigMissing />;
  return <AppStack />;
}

function AppStack() {
  const { t } = useLanguage();
  useSyncProfileLanguage();
  usePushRegistration();

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
      <Stack.Screen name="sign-in" options={{ presentation: "modal", title: t("titles.signIn") }} />
      <Stack.Screen name="service/[slug]" options={{ title: "" }} />
      <Stack.Screen name="booking/[id]" options={{ title: t("titles.booking") }} />
      <Stack.Screen name="profile" options={{ title: t("titles.profile") }} />
      <Stack.Screen name="dogs/index" options={{ title: t("titles.dogs") }} />
      <Stack.Screen name="dogs/[id]" options={{ title: t("titles.dog") }} />
      <Stack.Screen name="legal" options={{ title: t("titles.legal") }} />
      <Stack.Screen name="admin/index" options={{ title: t("titles.admin") }} />
      <Stack.Screen name="admin/agenda" options={{ title: t("admin.hubAgenda") }} />
      <Stack.Screen name="admin/services" options={{ title: t("admin.hubServices") }} />
      <Stack.Screen name="admin/service/[id]" options={{ title: "" }} />
      <Stack.Screen name="admin/availability" options={{ title: t("admin.hubAvailability") }} />
      <Stack.Screen name="admin/closures" options={{ title: t("admin.hubClosures") }} />
      <Stack.Screen name="admin/discounts" options={{ title: t("admin.hubDiscounts") }} />
      <Stack.Screen name="admin/documents" options={{ title: t("admin.hubDocuments") }} />
      <Stack.Screen name="admin/dashboard" options={{ title: t("admin.hubDashboard") }} />
      <Stack.Screen name="admin/clients" options={{ title: t("admin.hubClients") }} />
      <Stack.Screen name="admin/client/[id]" options={{ title: t("admin.clientTitle") }} />
      <Stack.Screen name="admin/vaccinations" options={{ title: t("admin.hubVaccinations") }} />
      <Stack.Screen name="admin/vaccine-types" options={{ title: t("admin.hubVaccineTypes") }} />
      <Stack.Screen name="admin/incidents" options={{ title: t("admin.hubIncidents") }} />
      <Stack.Screen name="admin/incident/[id]" options={{ title: t("admin.incidentTitle") }} />
      <Stack.Screen name="admin/emergency" options={{ title: t("admin.hubEmergency") }} />
      <Stack.Screen name="admin/park-rules" options={{ title: t("admin.hubParkRules") }} />
      <Stack.Screen name="admin/security" options={{ title: t("admin.hubSecurity") }} />
      <Stack.Screen name="admin/pricing/index" options={{ title: t("admin.hubPricing") }} />
      <Stack.Screen name="admin/pricing/[serviceId]" options={{ title: t("admin.pricingRulesTitle") }} />
      <Stack.Screen name="admin/calendar-days" options={{ title: t("admin.hubCalendarDays") }} />
      <Stack.Screen name="admin/calendar-sync" options={{ title: t("admin.hubCalendarSync") }} />
      <Stack.Screen name="rescue/[token]" options={{ title: t("adminExtra.rescuePageTitle") }} />
      <Stack.Screen name="live/[token]" options={{ title: t("admin.liveGuestTitle") }} />
      <Stack.Screen name="admin/new-event" options={{ presentation: "modal", title: t("titles.newEvent") }} />
    </Stack>
  );
}
