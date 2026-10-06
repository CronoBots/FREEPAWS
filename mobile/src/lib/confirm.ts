import { Alert, Platform } from "react-native";

/** Boîte de confirmation native (Alert) ou navigateur (window.confirm) sur le web. */
export function confirm(options: { title: string; message: string; confirmLabel: string; destructive?: boolean }) {
  return new Promise<boolean>((resolve) => {
    if (Platform.OS === "web") {
      resolve(globalThis.confirm?.(`${options.title}\n\n${options.message}`) ?? false);
      return;
    }
    Alert.alert(options.title, options.message, [
      { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
      {
        text: options.confirmLabel,
        style: options.destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

export function notify(title: string, message: string) {
  if (Platform.OS === "web") globalThis.alert?.(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
