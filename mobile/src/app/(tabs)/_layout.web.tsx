import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

import { colors, fonts } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Sur le web, les onglets natifs s’affichent en haut : on garde une barre classique en bas.
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: "index", title: "Le parc", icon: "paw-outline", iconActive: "paw" },
  { name: "services", title: "Coaching", icon: "people-outline", iconActive: "people" },
  { name: "bookings", title: "Réservations", icon: "list-outline", iconActive: "list" },
  { name: "account", title: "Compte", icon: "person-circle-outline", iconActive: "person-circle" },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.creamAlt,
          borderTopColor: colors.line,
          height: 76,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 16, marginTop: 2 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
