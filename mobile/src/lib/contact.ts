import { Linking } from "react-native";

import { env } from "@/lib/env";

/** Ouvre la messagerie vers FreePaws, comme le bouton « Prendre rendez-vous » du site. */
export function openContactEmail(subject?: string) {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return Linking.openURL(`mailto:${env.contactEmail}${query}`);
}
