import type { PropsWithChildren } from "react";

import { useAssurance } from "@/api/mfa";
import { useIsAdmin, useProfile } from "@/api/profile";
import { MfaChallenge } from "@/components/mfa-challenge";
import { Screen } from "@/components/screen";
import { EmptyView, LoadingView } from "@/components/state-views";
import { useLanguage } from "@/i18n";

/** N’affiche le contenu qu’à l’administratrice (la base refuse de toute façon les écritures des autres). */
export function AdminGuard({ children }: PropsWithChildren) {
  const { t } = useLanguage();
  const profile = useProfile();
  const isAdmin = useIsAdmin();
  const assurance = useAssurance();
  if (profile.isLoading || (isAdmin && assurance.isLoading)) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (!isAdmin) {
    return (
      <Screen underHeader>
        <EmptyView title={t("admin.restricted")} message={t("admin.restrictedText")} />
      </Screen>
    );
  }
  // Double authentification activée mais session validée par email seulement : on demande le code.
  if (assurance.data?.next === "aal2" && assurance.data.current !== "aal2") return <MfaChallenge />;
  return children;
}
