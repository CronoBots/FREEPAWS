import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

// Notifications push (M6-06, M9-08) : le jeton Expo de l’appareil est enregistré pour l’utilisateur
// connecté ; le serveur (send-notifications) envoie confirmations, rappels et alertes d’urgence.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Demande l’autorisation et enregistre l’appareil. Sans projet EAS configuré, ne fait rien. */
export async function registerForPush(channelNames: { default: string; urgent: string }): Promise<void> {
  if (!Device.isDevice) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: channelNames.default,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    // Alertes d’urgence : priorité maximale, y compris en mode « Ne pas déranger ».
    await Notifications.setNotificationChannelAsync("urgent", {
      name: channelNames.urgent,
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
      sound: "default",
      vibrationPattern: [0, 400, 200, 400],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? "granted" : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase
    .from("push_tokens")
    .upsert({ token, platform: Platform.OS === "ios" ? "ios" : "android", last_seen_at: new Date().toISOString() });
}
