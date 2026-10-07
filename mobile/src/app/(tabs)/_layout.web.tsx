import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useWindowDimensions } from "react-native";

import { CONTENT_MAX_WIDTH } from "@/components/screen";
import { type TranslationKey, useLanguage } from "@/i18n";
import { colors, fonts } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Sur le web, les onglets natifs s’affichent en haut : on garde une barre classique en bas.
const TABS: { name: string; title: TranslationKey; icon: IconName; iconActive: IconName }[] = [
  { name: "index", title: "tabs.park", icon: "paw-outline", iconActive: "paw" },
  { name: "services", title: "tabs.coaching", icon: "people-outline", iconActive: "people" },
  { name: "bookings", title: "tabs.bookingsShort", icon: "list-outline", iconActive: "list" },
  { name: "account", title: "tabs.account", icon: "person-circle-outline", iconActive: "person-circle" },
];

export default function TabsLayout() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  // Sur grand écran, les onglets restent alignés sur la colonne de contenu.
  const gutter = Math.max(0, (width - CONTENT_MAX_WIDTH) / 2);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.olive,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.creamAlt,
          borderTopColor: colors.line,
          height: 76,
          paddingTop: 8,
          paddingBottom: 10,
          paddingHorizontal: gutter,
        },
        tabBarLabelStyle: {
          fontFamily: width < 360 ? fonts.sansMedium : fonts.sansSemiBold,
          fontSize: width < 360 ? 11 : 13,
          lineHeight: 17,
          marginTop: 2,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
