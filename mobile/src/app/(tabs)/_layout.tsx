import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useLanguage } from "@/i18n";
import { colors } from "@/theme";

export default function TabsLayout() {
  const { t } = useLanguage();
  return (
    <NativeTabs tintColor={colors.ink} backgroundColor={colors.creamAlt} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "pawprint", selected: "pawprint.fill" }} md="pets" />
        <NativeTabs.Trigger.Label>{t("tabs.park")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="services">
        <NativeTabs.Trigger.Icon sf={{ default: "person.2", selected: "person.2.fill" }} md="groups" />
        <NativeTabs.Trigger.Label>{t("tabs.coaching")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }}
          md="event_note"
        />
        <NativeTabs.Trigger.Label>{t("tabs.bookings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="account_circle"
        />
        <NativeTabs.Trigger.Label>{t("tabs.account")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
