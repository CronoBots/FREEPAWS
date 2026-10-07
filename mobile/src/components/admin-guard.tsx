import type { PropsWithChildren } from "react";

import { useIsAdmin, useProfile } from "@/api/profile";
import { Screen } from "@/components/screen";
import { EmptyView, LoadingView } from "@/components/state-views";
import { useLanguage } from "@/i18n";

/** N’affiche le contenu qu’à l’administratrice (la base refuse de toute façon les écritures des autres). */
export function AdminGuard({ children }: PropsWithChildren) {
  const { t } = useLanguage();
  const profile = useProfile();
  const isAdmin = useIsAdmin();
  if (profile.isLoading) {
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
  return children;
}
